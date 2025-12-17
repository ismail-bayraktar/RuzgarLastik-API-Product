"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
	Play, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, 
	FlaskConical, Eye, Package, DollarSign, ShoppingBag, 
	ArrowRight, RefreshCw, AlertTriangle, Circle, Database, Calendar
} from "lucide-react";

interface SyncStep {
	id: string;
	name: string;
	status: "pending" | "running" | "completed" | "error";
	message?: string;
	duration?: number;
	data?: any;
}

interface ProductPreview {
	supplierSku: string;
	title: string;
	brand: string;
	category: string;
	price: number;
	calculatedPrice?: number;
	stock: number;
	status: "pending" | "success" | "error" | "skipped";
	error?: string;
}

interface CacheCategory {
	category: string;
	lastFetchAt: string | null;
	productCount: number;
	status: string;
	isStale: boolean;
	refreshIntervalHours: number;
}

export default function SyncPage() {
	const [mode, setMode] = useState<"full" | "incremental">("incremental");
	const [dryRun, setDryRun] = useState(false);
	const [testMode, setTestMode] = useState(true);
	const [productLimit, setProductLimit] = useState(5);
	const [selectedCategories, setSelectedCategories] = useState<string[]>(["tire", "rim", "battery"]);
	const [showPreview, setShowPreview] = useState(false);
	const [forceRefresh, setForceRefresh] = useState(false);
	const [previewData, setPreviewData] = useState<{
		steps: SyncStep[];
		products: ProductPreview[];
		errors: string[];
		fromCache?: boolean;
		summary: { total: number; success: number; errors: number; skipped: number };
	} | null>(null);

	const syncHistory = useQuery(trpc.sync.history.queryOptions({ limit: 10 }));

	const cacheStatusQuery = useQuery({
		queryKey: ["cacheStatus"],
		queryFn: async () => {
			const response = await fetch("http://localhost:5000/trpc/sync.cacheStatus", {
				method: "GET",
				credentials: "include",
			});
			const data = await response.json();
			if (data?.result?.data) return data.result.data;
			throw new Error("Cache status alınamadı");
		},
		refetchInterval: 30000,
	});

	const refreshCacheMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("http://localhost:5000/trpc/sync.refreshCache", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ "0": { categories: selectedCategories } }),
				credentials: "include",
			});
			const data = await response.json();
			if (data[0]?.result?.data) return data[0].result.data;
			throw new Error(data[0]?.error?.message || "Cache yenileme hatası");
		},
		onSuccess: (data) => {
			toast.success(`Cache yenilendi! ${data.productCount} ürün çekildi`);
			cacheStatusQuery.refetch();
		},
		onError: (error: any) => {
			toast.error(`Cache yenileme hatası: ${error.message}`);
		},
	});
	
	const previewMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("http://localhost:5000/trpc/sync.preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ "0": { categories: selectedCategories, productLimit: testMode ? productLimit : 50, forceRefresh } }),
				credentials: "include",
			});
			const data = await response.json();
			if (data[0]?.result?.data) return data[0].result.data;
			throw new Error(data[0]?.error?.message || "Önizleme hatası");
		},
		onSuccess: (data) => {
			setPreviewData(data);
			setShowPreview(true);
			cacheStatusQuery.refetch();
			if (data.errors.length > 0) {
				toast.error(`${data.errors.length} hata bulundu`);
			} else {
				const source = data.fromCache ? "cache'den" : "API'den";
				toast.success(`${data.summary.total} ürün ${source} yüklendi`);
			}
		},
		onError: (error: any) => {
			toast.error(`Önizleme hatası: ${error.message}`);
		},
	});

	const startSyncMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("http://localhost:5000/trpc/sync.start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ "0": { mode, categories: selectedCategories, dryRun, testMode, productLimit: testMode ? productLimit : undefined } }),
				credentials: "include",
			});
			const data = await response.json();
			if (data[0]?.result?.data) return data[0].result.data;
			throw new Error(data[0]?.error?.message || "Sync hatası");
		},
		onSuccess: (data) => {
			toast.success(`Sync başlatıldı! Session ID: ${data.sessionId}`);
			syncHistory.refetch();
		},
		onError: (error: any) => {
			toast.error(`Hata: ${error.message}`);
		},
	});

	const toggleCategory = (category: string) => {
		if (selectedCategories.includes(category)) {
			setSelectedCategories(selectedCategories.filter((c) => c !== category));
		} else {
			setSelectedCategories([...selectedCategories, category]);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
			case "success":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "running":
			case "fetching":
				return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
			case "failed":
			case "error":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "skipped":
				return <AlertTriangle className="h-4 w-4 text-amber-500" />;
			case "pending":
			case "idle":
				return <Circle className="h-4 w-4 text-muted-foreground" />;
			default:
				return <Clock className="h-4 w-4 text-muted-foreground" />;
		}
	};

	const getCategoryLabel = (cat: string) => {
		switch (cat) {
			case "tire": return "Lastik";
			case "rim": return "Jant";
			case "battery": return "Akü";
			default: return cat;
		}
	};

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "Hiç";
		const date = new Date(dateStr);
		return date.toLocaleString("tr-TR", { 
			day: "2-digit", 
			month: "2-digit", 
			year: "numeric",
			hour: "2-digit", 
			minute: "2-digit" 
		});
	};

	const getTimeSince = (dateStr: string | null) => {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		
		if (diffHours > 24) {
			const days = Math.floor(diffHours / 24);
			return `${days} gün önce`;
		}
		if (diffHours > 0) {
			return `${diffHours} saat ${diffMins} dk önce`;
		}
		return `${diffMins} dk önce`;
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">Senkronizasyon</h1>
					<p className="text-muted-foreground mt-1">Tedarikçi ve Shopify senkronizasyonu</p>
				</div>

				<div className="mb-6 bg-card border border-border rounded-lg p-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Database className="h-5 w-5 text-primary" />
							<h2 className="text-base font-medium text-foreground">Ürün Cache Durumu</h2>
						</div>
						<button
							onClick={() => refreshCacheMutation.mutate()}
							disabled={refreshCacheMutation.isPending}
							className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
						>
							{refreshCacheMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							{refreshCacheMutation.isPending ? "Yenileniyor..." : "Cache'i Yenile"}
						</button>
					</div>

					{cacheStatusQuery.isLoading ? (
						<div className="flex items-center justify-center py-4">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					) : cacheStatusQuery.error ? (
						<div className="text-center py-4 text-sm text-muted-foreground">
							Cache durumu alınamadı
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{(cacheStatusQuery.data?.categories || []).map((cat: CacheCategory) => (
								<div 
									key={cat.category}
									className={`p-3 rounded-lg border ${
										cat.isStale 
											? "bg-amber-500/5 border-amber-500/30" 
											: "bg-green-500/5 border-green-500/30"
									}`}
								>
									<div className="flex items-center justify-between mb-2">
										<span className="font-medium text-foreground">
											{getCategoryLabel(cat.category)}
										</span>
										<span className={`text-xs px-2 py-0.5 rounded ${
											cat.isStale 
												? "bg-amber-500/20 text-amber-600" 
												: "bg-green-500/20 text-green-600"
										}`}>
											{cat.isStale ? "Eskimiş" : "Güncel"}
										</span>
									</div>
									<div className="space-y-1 text-sm">
										<div className="flex items-center gap-2 text-muted-foreground">
											<Package className="h-3.5 w-3.5" />
											<span>{cat.productCount.toLocaleString("tr-TR")} ürün</span>
										</div>
										<div className="flex items-center gap-2 text-muted-foreground">
											<Calendar className="h-3.5 w-3.5" />
											<span>{formatDate(cat.lastFetchAt)}</span>
										</div>
										{cat.lastFetchAt && (
											<p className="text-xs text-muted-foreground pl-5">
												({getTimeSince(cat.lastFetchAt)})
											</p>
										)}
									</div>
								</div>
							))}
							{(!cacheStatusQuery.data?.categories || cacheStatusQuery.data.categories.length === 0) && (
								<div className="col-span-3 text-center py-4 text-sm text-muted-foreground">
									Cache henüz oluşturulmadı. "Cache'i Yenile" butonuna tıklayın.
								</div>
							)}
						</div>
					)}

					{cacheStatusQuery.data?.totalProducts > 0 && (
						<div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Toplam: <strong className="text-foreground">{cacheStatusQuery.data.totalProducts.toLocaleString("tr-TR")}</strong> ürün cache'de
							</span>
							<span className="text-xs text-muted-foreground">
								Otomatik yenileme: Her 24 saatte bir
							</span>
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-lg font-medium text-foreground mb-6">Yeni Sync Başlat</h2>
						
						<div className="space-y-6">
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Sync Modu</label>
								<div className="flex gap-2">
									<button
										onClick={() => setMode("incremental")}
										className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
											mode === "incremental"
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground hover:bg-muted/80"
										}`}
									>
										Incremental
									</button>
									<button
										onClick={() => setMode("full")}
										className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
											mode === "full"
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground hover:bg-muted/80"
										}`}
									>
										Full
									</button>
								</div>
							</div>

							<div>
								<label className="block text-sm text-muted-foreground mb-2">Kategoriler</label>
								<div className="space-y-2">
									{[
										{ id: "tire", label: "Lastik" },
										{ id: "rim", label: "Jant" },
										{ id: "battery", label: "Akü" },
									].map((category) => (
										<label key={category.id} className="flex items-center gap-3 cursor-pointer">
											<input
												type="checkbox"
												checked={selectedCategories.includes(category.id)}
												onChange={() => toggleCategory(category.id)}
												className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
											/>
											<span className="text-sm text-foreground">{category.label}</span>
										</label>
									))}
								</div>
							</div>

							<div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
								<div className="flex items-center gap-2 mb-2">
									<FlaskConical className="h-4 w-4 text-amber-500" />
									<span className="text-sm font-medium text-foreground">Test Modu Ayarları</span>
								</div>
								
								<label className="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={testMode}
										onChange={(e) => setTestMode(e.target.checked)}
										className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
									/>
									<div>
										<span className="text-sm text-foreground">Test Modu</span>
										<p className="text-xs text-muted-foreground">Sınırlı sayıda ürünle hızlı test</p>
									</div>
								</label>

								{testMode && (
									<div className="ml-7">
										<label className="block text-xs text-muted-foreground mb-1">Ürün Limiti</label>
										<div className="flex items-center gap-2">
											<input
												type="number"
												value={productLimit}
												onChange={(e) => setProductLimit(Math.max(1, Number(e.target.value)))}
												min={1}
												max={100}
												className="w-24 px-3 py-1.5 bg-background border border-input rounded-lg text-sm text-foreground"
											/>
											<span className="text-xs text-muted-foreground">ürün işlenecek</span>
										</div>
										<div className="flex gap-1 mt-2">
											{[5, 10, 25, 50].map((num) => (
												<button
													key={num}
													onClick={() => setProductLimit(num)}
													className={`px-2 py-1 text-xs rounded ${productLimit === num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
												>
													{num}
												</button>
											))}
										</div>
									</div>
								)}

								<label className="flex items-center gap-3 cursor-pointer mt-2">
									<input
										type="checkbox"
										checked={forceRefresh}
										onChange={(e) => setForceRefresh(e.target.checked)}
										className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
									/>
									<div>
										<span className="text-sm text-foreground">Zorla Yenile</span>
										<p className="text-xs text-muted-foreground">Cache'i bypass et, API'den taze veri çek</p>
									</div>
								</label>

								<label className="flex items-center gap-3 cursor-pointer mt-2">
									<input
										type="checkbox"
										checked={dryRun}
										onChange={(e) => setDryRun(e.target.checked)}
										className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
									/>
									<div>
										<span className="text-sm text-foreground">Dry Run</span>
										<p className="text-xs text-muted-foreground">Shopify'a veri göndermeden simüle et</p>
									</div>
								</label>
							</div>

							<div className="flex gap-2">
								<button
									onClick={() => previewMutation.mutate()}
									disabled={previewMutation.isPending || selectedCategories.length === 0}
									className="flex-1 inline-flex items-center justify-center gap-2 bg-muted text-foreground py-3 px-6 rounded-lg font-medium hover:bg-muted/80 transition disabled:opacity-50 disabled:cursor-not-allowed border border-border"
								>
									{previewMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Eye className="h-4 w-4" />
									)}
									{previewMutation.isPending ? "Önizleniyor..." : "Önizle"}
								</button>
								<button
									onClick={() => startSyncMutation.mutate()}
									disabled={startSyncMutation.isPending || selectedCategories.length === 0}
									className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{startSyncMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Play className="h-4 w-4" />
									)}
									{startSyncMutation.isPending ? "Başlatılıyor..." : "Sync Başlat"}
								</button>
							</div>
						</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-lg font-medium text-foreground mb-6">Son Sync İşlemleri</h2>
						
						{syncHistory.isLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : syncHistory.data?.sessions.length === 0 ? (
							<div className="text-center py-8">
								<AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">Henüz sync işlemi yapılmadı.</p>
							</div>
						) : (
							<div className="space-y-3">
								{syncHistory.data?.sessions.map((session: any) => (
									<div
										key={session.id}
										className="flex items-center gap-3 p-3 rounded-lg border border-border"
									>
										{getStatusIcon(session.status)}
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-foreground">
												{new Date(session.startedAt).toLocaleString("tr-TR")}
											</p>
											<p className="text-xs text-muted-foreground">{session.mode} sync</p>
										</div>
										<span
											className={`text-xs px-2 py-1 rounded ${
												session.status === "completed"
													? "bg-green-500/10 text-green-500"
													: session.status === "running"
													? "bg-blue-500/10 text-blue-500"
													: "bg-red-500/10 text-red-500"
											}`}
										>
											{session.status}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{showPreview && previewData && (
					<div className="mt-6 bg-card border border-border rounded-lg p-6">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-lg font-medium text-foreground flex items-center gap-2">
								<Eye className="h-5 w-5 text-primary" />
								Sync Önizlemesi
								{previewData.fromCache && (
									<span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded ml-2">
										Cache'den
									</span>
								)}
							</h2>
							<button
								onClick={() => setShowPreview(false)}
								className="text-muted-foreground hover:text-foreground text-sm"
							>
								Kapat
							</button>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
							<div className="bg-muted/30 rounded-lg p-4 border border-border">
								<div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
									<Package className="h-4 w-4" />
									Toplam
								</div>
								<p className="text-2xl font-semibold text-foreground">{previewData.summary.total}</p>
							</div>
							<div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
								<div className="flex items-center gap-2 text-green-600 text-sm mb-1">
									<CheckCircle2 className="h-4 w-4" />
									Başarılı
								</div>
								<p className="text-2xl font-semibold text-green-600">{previewData.summary.success}</p>
							</div>
							<div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
								<div className="flex items-center gap-2 text-red-600 text-sm mb-1">
									<XCircle className="h-4 w-4" />
									Hata
								</div>
								<p className="text-2xl font-semibold text-red-600">{previewData.summary.errors}</p>
							</div>
							<div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
								<div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
									<AlertTriangle className="h-4 w-4" />
									Atlandı
								</div>
								<p className="text-2xl font-semibold text-amber-600">{previewData.summary.skipped}</p>
							</div>
						</div>

						<div className="mb-6">
							<h3 className="text-sm font-medium text-foreground mb-3">İşlem Adımları</h3>
							<div className="flex items-center gap-2 flex-wrap">
								{previewData.steps.map((step, index) => (
									<div key={step.id} className="flex items-center gap-2">
										<div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
											step.status === "completed" ? "bg-green-500/10 text-green-600 border border-green-500/20" :
											step.status === "error" ? "bg-red-500/10 text-red-600 border border-red-500/20" :
											step.status === "running" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
											"bg-muted text-muted-foreground border border-border"
										}`}>
											{getStatusIcon(step.status)}
											<span>{step.name}</span>
											{step.duration && (
												<span className="text-xs opacity-70">({step.duration}ms)</span>
											)}
										</div>
										{index < previewData.steps.length - 1 && (
											<ArrowRight className="h-4 w-4 text-muted-foreground" />
										)}
									</div>
								))}
							</div>
							{previewData.steps.some(s => s.message) && (
								<div className="mt-3 space-y-1">
									{previewData.steps.filter(s => s.message).map(step => (
										<p key={step.id} className={`text-xs ${step.status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
											• {step.name}: {step.message}
										</p>
									))}
								</div>
							)}
						</div>

						{previewData.errors.length > 0 && (
							<div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
								<h3 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
									<AlertCircle className="h-4 w-4" />
									Hatalar ({previewData.errors.length})
								</h3>
								<ul className="space-y-1">
									{previewData.errors.map((error, i) => (
										<li key={i} className="text-sm text-red-600">• {error}</li>
									))}
								</ul>
							</div>
						)}

						<div>
							<h3 className="text-sm font-medium text-foreground mb-3">Ürün Önizlemesi</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-border">
											<th className="text-left py-2 px-3 text-muted-foreground font-medium">Durum</th>
											<th className="text-left py-2 px-3 text-muted-foreground font-medium">SKU</th>
											<th className="text-left py-2 px-3 text-muted-foreground font-medium">Ürün</th>
											<th className="text-left py-2 px-3 text-muted-foreground font-medium">Marka</th>
											<th className="text-left py-2 px-3 text-muted-foreground font-medium">Kategori</th>
											<th className="text-right py-2 px-3 text-muted-foreground font-medium">Alış</th>
											<th className="text-right py-2 px-3 text-muted-foreground font-medium">Satış</th>
											<th className="text-right py-2 px-3 text-muted-foreground font-medium">Stok</th>
										</tr>
									</thead>
									<tbody>
										{previewData.products.map((product) => (
											<tr key={product.supplierSku} className="border-b border-border/50 hover:bg-muted/30">
												<td className="py-2 px-3">{getStatusIcon(product.status)}</td>
												<td className="py-2 px-3 font-mono text-xs">{product.supplierSku}</td>
												<td className="py-2 px-3">
													<span className="line-clamp-1" title={product.title}>
														{product.title.length > 40 ? product.title.slice(0, 40) + "..." : product.title}
													</span>
													{product.error && (
														<p className="text-xs text-red-500 mt-0.5">{product.error}</p>
													)}
												</td>
												<td className="py-2 px-3">{product.brand}</td>
												<td className="py-2 px-3">
													<span className={`text-xs px-2 py-0.5 rounded ${
														product.category === "tire" ? "bg-blue-500/10 text-blue-600" :
														product.category === "rim" ? "bg-purple-500/10 text-purple-600" :
														"bg-green-500/10 text-green-600"
													}`}>
														{getCategoryLabel(product.category)}
													</span>
												</td>
												<td className="py-2 px-3 text-right font-mono">{product.price.toFixed(2)} ₺</td>
												<td className="py-2 px-3 text-right font-mono text-green-600">
													{product.calculatedPrice?.toFixed(2) || "-"} ₺
												</td>
												<td className="py-2 px-3 text-right">{product.stock}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						<div className="mt-6 flex justify-end gap-2">
							<button
								onClick={() => {
									setForceRefresh(true);
									previewMutation.mutate();
								}}
								disabled={previewMutation.isPending}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80 transition"
							>
								<RefreshCw className={`h-4 w-4 ${previewMutation.isPending ? "animate-spin" : ""}`} />
								Zorla Yenile
							</button>
							<button
								onClick={() => startSyncMutation.mutate()}
								disabled={startSyncMutation.isPending || previewData.errors.length > 0}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
							>
								{startSyncMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Play className="h-4 w-4" />
								)}
								{dryRun ? "Dry Run Başlat" : "Shopify'a Gönder"}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
