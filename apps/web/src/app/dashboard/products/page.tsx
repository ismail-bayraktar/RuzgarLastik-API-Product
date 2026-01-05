"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc, queryClient } from "@/utils/trpc";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Package, Circle, Disc3, Battery, Loader2, RefreshCw, 
  Search, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
  ExternalLink, Filter, Sparkles
} from "lucide-react";
import { ProductDrawer, type ProductDrawerData, type TabId } from "@/components/sync/ProductDrawer";

export default function ProductsPage() {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<string>("all");
	const [category, setCategory] = useState<string>("all");
	const [page, setPage] = useState(1);
	const limit = 25;

	// Drawer States
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<ProductDrawerData | null>(null);
	const [drawerTab, setDrawerTab] = useState<TabId>("raw");

	const products = useQuery(trpc.products.list.queryOptions({ 
		limit, 
		offset: (page - 1) * limit,
		search: search || undefined,
		status: status === "all" ? undefined : status as any,
		category: category === "all" ? undefined : category as any,
	}));

	const stats = useQuery(trpc.products.syncStats.queryOptions());

	const reprocessAllMutation = useMutation({
		...(trpc.sync.reprocessAll.mutationOptions() as any),
		onSuccess: (data: any) => {
			toast.success(data.message);
			products.refetch();
			stats.refetch();
		},
		onError: (error: any) => {
			toast.error(`Hata: ${error.message}`);
		}
	});

	// Product detail query for drawer
	const productDetailQuery = useQuery({
		...trpc.sync.productDetail.queryOptions({
			supplierSku: selectedProduct?.supplierSku || "",
			category: selectedProduct?.category,
		}),
		enabled: drawerOpen && !!selectedProduct?.supplierSku,
	});

	const openProductDrawer = useCallback((product: any) => {
		const drawerData: ProductDrawerData = {
			supplierSku: product.sku,
			title: product.title,
			category: product.category as any,
			rawData: {}, // Will be filled by detail query
			parsedData: { brand: product.brand },
			metafields: [],
			shopifyProduct: null,
		};
		setSelectedProduct(drawerData);
		setDrawerTab("raw");
		setDrawerOpen(true);
	}, []);

	const enrichedProduct = useCallback((): ProductDrawerData | null => {
		if (!selectedProduct) return null;
		const detail = productDetailQuery.data as any; // Use any to avoid complex union type errors in UI
		if (!detail || !detail.success) return selectedProduct;

		return {
			...selectedProduct,
			title: detail.title || selectedProduct.title,
			rawData: detail.rawData || selectedProduct.rawData,
			parsedData: detail.parsedData,
			parsingResult: detail.parsingResult,
			metafields: detail.metafields,
			pricing: detail.pricing,
			shopifyProduct: detail.shopifyProduct,
			shopifyChanges: detail.shopifyChanges,
			shopifyLookupError: detail.shopifyLookupError,
		};
	}, [selectedProduct, productDetailQuery.data]);

	const totalPages = Math.ceil((products.data?.total || 0) / limit);

	return (
		<div className="p-6 lg:p-8 space-y-6">
			<div className="max-w-7xl mx-auto">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
					<div>
						<h1 className="text-2xl font-semibold text-foreground">Ürün Yönetimi</h1>
						<p className="text-muted-foreground mt-1">Veritabanındaki tüm tedarikçi ürünleri ve kalite durumu</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => { products.refetch(); stats.refetch(); }}
							className="p-2 hover:bg-muted rounded-lg transition-colors border border-border"
							title="Listeyi Yenile"
						>
							<RefreshCw className={`h-4 w-4 text-muted-foreground ${(products.isFetching || stats.isFetching) ? 'animate-spin' : ''}`} />
						</button>
						<button
							onClick={() => {
								if (window.confirm("Tum urunleri yeni parser ile yeniden islemek istediginize emin misiniz? Bu islem biraz zaman alabilir.")) {
									reprocessAllMutation.mutate(undefined);
								}
							}}
							disabled={reprocessAllMutation.isPending}
							className="inline-flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition disabled:opacity-50"
						>
							{reprocessAllMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Sparkles className="h-4 w-4" />
							)}
							Verileri Yeniden Isle
						</button>
						<Link
							href="/dashboard/sync"
							className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
						>
							Sync Panel
						</Link>
					</div>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					<StatCard label="Toplam Ürün" value={stats.data?.totalProducts || 0} />
					<StatCard label="Yayında (Shopify)" value={stats.data?.bySyncStatus.synced || 0} color="blue" />
					<StatCard label="Hazır (Valid)" value={stats.data?.bySyncStatus.pending || 0} color="green" />
					<StatCard label="Hatalı (Invalid)" value={stats.data?.bySyncStatus.failed || 0} color="red" />
				</div>

				{/* Filters & Search */}
				<div className="bg-card border border-border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center">
					<div className="relative flex-1 w-full">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="SKU, Başlık veya Marka ara..."
							value={search}
							onChange={(e) => { setSearch(e.target.value); setPage(1); }}
							className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
						/>
					</div>
					<div className="flex items-center gap-2 w-full md:w-auto">
						<select 
							value={category}
							onChange={(e) => { setCategory(e.target.value); setPage(1); }}
							className="bg-background border border-input rounded-lg text-sm px-3 py-2 outline-none"
						>
							<option value="all">Tüm Kategoriler</option>
							<option value="tire">Lastik</option>
							<option value="rim">Jant</option>
							<option value="battery">Akü</option>
						</select>
						<select 
							value={status}
							onChange={(e) => { setStatus(e.target.value); setPage(1); }}
							className="bg-background border border-input rounded-lg text-sm px-3 py-2 outline-none"
						>
							<option value="all">Tüm Durumlar</option>
							<option value="valid">Hazır (Valid)</option>
							<option value="invalid">Hatalı (Invalid)</option>
							<option value="published">Yayında</option>
							<option value="needs_update">Güncelleme</option>
						</select>
					</div>
				</div>

				{/* Product Table */}
				<div className="bg-card border border-border rounded-lg overflow-hidden mt-6">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead className="bg-muted/50 border-b border-border">
								<tr>
									<th className="px-4 py-3 font-medium text-muted-foreground">Ürün</th>
									<th className="px-4 py-3 font-medium text-muted-foreground">Kategori</th>
									<th className="px-4 py-3 font-medium text-muted-foreground">Fiyat/Stok</th>
									<th className="px-4 py-3 font-medium text-muted-foreground">Kalite</th>
									<th className="px-4 py-3 font-medium text-muted-foreground">Shopify</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{products.isLoading ? (
									<tr>
										<td colSpan={5} className="py-12 text-center">
											<Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
											<p className="mt-2 text-muted-foreground">Ürünler yükleniyor...</p>
										</td>
									</tr>
								) : products.data?.products.length === 0 ? (
									<tr>
										<td colSpan={5} className="py-12 text-center text-muted-foreground">
											Ürün bulunamadı.
										</td>
									</tr>
								) : (
									products.data?.products.map((p) => (
										<tr key={p.id} onClick={() => openProductDrawer(p)} className="border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
											<td className="px-4 py-3 max-w-xs">
												<div className="font-mono text-[10px] text-primary font-bold">{p.sku}</div>
												<div className="font-medium text-foreground truncate" title={p.title}>{p.title}</div>
												<div className="text-[10px] text-muted-foreground">{p.brand || "Marka Belirtilmemiş"}</div>
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center gap-1.5">
													{getCategoryIcon(p.category)}
													<span className="capitalize">{p.category === 'tire' ? 'Lastik' : p.category === 'rim' ? 'Jant' : 'Akü'}</span>
												</div>
											</td>
											<td className="px-4 py-3">
												<div className="font-medium">{p.price.toLocaleString("tr-TR")} ₺</div>
												<div className="text-[10px] text-muted-foreground">{p.stock} adet stok</div>
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-col gap-1">
													{getStatusBadge(p.status)}
													{p.status === "invalid" && p.errors && (
														<div className="text-[9px] text-red-400 max-w-[150px] truncate" title={JSON.stringify(p.errors)}>
															{Object.keys(p.errors as object).join(", ")} eksik
														</div>
													)}
												</div>
											</td>
											<td className="px-4 py-3">
												{p.shopifyId ? (
													<a 
														href={`https://admin.shopify.com/store/${process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN}/products/${p.shopifyId.replace("gid://shopify/Product/", "")}`}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
													>
														Görüntüle <ExternalLink className="h-3 w-3" />
													</a>
												) : (
													<span className="text-muted-foreground text-xs">—</span>
												)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					<div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
						<div className="text-xs text-muted-foreground">
							Toplam <b>{products.data?.total || 0}</b> ürün arasından <b>{(page-1)*limit + 1}-{Math.min(page*limit, products.data?.total || 0)}</b> gösteriliyor
						</div>
						<div className="flex items-center gap-2">
							<button
								disabled={page === 1 || products.isLoading}
								onClick={() => setPage(p => p - 1)}
								className="p-2 hover:bg-muted rounded-md border border-border disabled:opacity-30 transition-all"
							>
								<ChevronLeft className="h-4 w-4" />
							</button>
							<div className="text-xs font-medium px-2">
								Sayfa {page} / {totalPages || 1}
							</div>
							<button
								disabled={page === totalPages || products.isLoading}
								onClick={() => setPage(p => p + 1)}
								className="p-2 hover:bg-muted rounded-md border border-border disabled:opacity-30 transition-all"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			</div>

			<ProductDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				product={enrichedProduct()}
				activeTab={drawerTab}
				onTabChange={setDrawerTab}
			/>
		</div>
	);
}

function StatCard({ label, value, color }: { label: string; value: number; color?: "blue" | "green" | "red" }) {
	const colorClasses = {
		blue: "bg-blue-500",
		green: "bg-green-500",
		red: "bg-red-500",
	};

	return (
		<div className="bg-card border border-border rounded-lg p-4 shadow-sm">
			<div className="flex items-center gap-2 mb-2">
				{color && <div className={`w-1.5 h-1.5 rounded-full ${colorClasses[color]}`} />}
				<p className="text-xs text-muted-foreground font-medium">{label}</p>
			</div>
			<p className="text-2xl font-bold text-foreground tracking-tight">
				{value.toLocaleString("tr-TR")}
			</p>
		</div>
	);
}

function getCategoryIcon(category: string) {
	switch (category) {
		case "tire": return <Disc3 className="h-4 w-4 text-blue-500" />;
		case "rim": return <Circle className="h-4 w-4 text-orange-500" />;
		case "battery": return <Battery className="h-4 w-4 text-red-500" />;
		default: return <Package className="h-4 w-4 text-gray-500" />;
	}
}

function getStatusBadge(status: string) {
	switch (status) {
		case "valid":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500">
					<CheckCircle2 className="h-3 w-3" /> Hazır
				</span>
			);
		case "invalid":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-500">
					<AlertCircle className="h-3 w-3" /> Hatalı
				</span>
			);
		case "published":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500">
					<ExternalLink className="h-3 w-3" /> Yayında
				</span>
			);
		case "needs_update":
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/10 text-yellow-500">
					<RefreshCw className="h-3 w-3" /> Güncelleme
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/10 text-gray-500">
					<Circle className="h-3 w-3" /> Raw
				</span>
			);
	}
}