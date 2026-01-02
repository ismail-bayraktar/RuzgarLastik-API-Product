"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Plug,
	Play,
	Loader2,
	CheckCircle2,
	XCircle,
	Copy,
	ChevronDown,
	Package,
	Car,
	Battery,
	CircleDot,
	Layers,
} from "lucide-react";

const DEGERAS_CATEGORIES = [
	{
		id: "all",
		name: "Tumu",
		icon: Layers,
		url: "https://netclick-apis.degeras.com/api/Product/2429/35504328-5066-4527-880d-8f5870f6a68a/",
	},
	{
		id: "lastik",
		name: "Lastik",
		icon: CircleDot,
		url: "https://netclick-apis.degeras.com/api/Product/2429/35504328-5066-4527-880d-8f5870f6a68a/f91b12e7-0ac3-4e3b-8564-daee7a049647",
	},
	{
		id: "jant",
		name: "Jant",
		icon: Car,
		url: "https://netclick-apis.degeras.com/api/Product/2429/35504328-5066-4527-880d-8f5870f6a68a/43fab35a-909e-4b5f-bb06-cb0c4273372a",
	},
	{
		id: "jant_on_siparis",
		name: "Jant On Siparis",
		icon: Package,
		url: "https://netclick-apis.degeras.com/api/Product/2429/35504328-5066-4527-880d-8f5870f6a68a/c3f12490-9855-41b7-9868-5bd1d7da51aa",
	},
	{
		id: "aku",
		name: "Aku",
		icon: Battery,
		url: "https://netclick-apis.degeras.com/api/Product/2429/35504328-5066-4527-880d-8f5870f6a68a/08474690-0a2e-41af-b3b0-0b448ac9db07",
	},
	{
		id: "katalog",
		name: "Katalog",
		icon: Package,
		url: "https://netclick-apis.degeras.com/api/Product/2429/35504328-5066-4527-880d-8f5870f6a68a/fc90b24a-cd11-4bbb-a5be-4fcb19725510",
	},
];

interface TestResult {
	success: boolean;
	status?: number;
	message: string;
	data?: unknown;
	responseTime?: number;
	productCount?: number;
}

export default function ApiTestPage() {
	const [selectedCategory, setSelectedCategory] = useState(DEGERAS_CATEGORIES[0]);
	const [testing, setTesting] = useState(false);
	const [result, setResult] = useState<TestResult | null>(null);
	const [dropdownOpen, setDropdownOpen] = useState(false);

	const testConnection = async () => {
		setTesting(true);
		setResult(null);

		const startTime = Date.now();

		try {
			const response = await fetch(`/api/supplier-test?url=${encodeURIComponent(selectedCategory.url)}&category=${encodeURIComponent(selectedCategory.name)}`);
			const responseTime = Date.now() - startTime;
			const data = await response.json();

			if (data.success) {
				setResult({
					success: true,
					status: 200,
					message: data.cachedCategory 
						? `Baglanti basarili! Urunler "${data.cachedCategory}" kategorisinde cache'e kaydedildi.`
						: "Baglanti basarili!",
					data: data.preview,
					responseTime,
					productCount: data.productCount,
				});
				toast.success(`API baglantisi basarili! ${data.productCount} urun bulundu${data.cachedCategory ? " ve cache'e kaydedildi" : ""}.`);
			} else {
				setResult({
					success: false,
					status: data.status,
					message: data.error || "API hatasi",
					responseTime,
				});
				toast.error("API baglanti hatasi");
			}
		} catch (error: unknown) {
			const responseTime = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
			setResult({
				success: false,
				message: errorMessage,
				responseTime,
			});
			toast.error("Baglanti basarisiz");
		} finally {
			setTesting(false);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Panoya kopyalandi");
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-5xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">Tedarikci API Test</h1>
					<p className="text-muted-foreground mt-1">Degeras API baglantisini test edin</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="lg:col-span-2 space-y-6">
						<div className="bg-card border border-border rounded-lg p-6">
							<h2 className="text-lg font-medium text-foreground mb-6">Kategori Sec</h2>

							<div className="relative mb-6">
								<button
									onClick={() => setDropdownOpen(!dropdownOpen)}
									className="w-full flex items-center justify-between px-4 py-3 bg-background border border-input rounded-lg text-foreground hover:border-primary/50 transition-colors"
								>
									<div className="flex items-center gap-3">
										<selectedCategory.icon className="h-5 w-5 text-muted-foreground" />
										<span>{selectedCategory.name}</span>
									</div>
									<ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
								</button>

								{dropdownOpen && (
									<div className="absolute z-10 w-full mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
										{DEGERAS_CATEGORIES.map((category) => {
											const Icon = category.icon;
											return (
												<button
													key={category.id}
													onClick={() => {
														setSelectedCategory(category);
														setDropdownOpen(false);
														setResult(null);
													}}
													className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors ${
														selectedCategory.id === category.id ? "bg-primary/10 text-primary" : "text-foreground"
													}`}
												>
													<Icon className="h-5 w-5" />
													<span>{category.name}</span>
												</button>
											);
										})}
									</div>
								)}
							</div>

							<div className="mb-6">
								<label className="block text-sm text-muted-foreground mb-2">API URL</label>
								<div className="flex items-center gap-2">
									<input
										type="text"
										value={selectedCategory.url}
										readOnly
										className="flex-1 px-3 py-2 bg-muted border border-input rounded-lg text-foreground text-sm font-mono"
									/>
									<button
										onClick={() => copyToClipboard(selectedCategory.url)}
										className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
									>
										<Copy className="h-4 w-4" />
									</button>
								</div>
							</div>

							<button
								onClick={testConnection}
								disabled={testing}
								className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
							>
								{testing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Play className="h-4 w-4" />
								)}
								{testing ? "Test Ediliyor..." : "Baglantiyi Test Et"}
							</button>
						</div>

						{result && (
							<div className="bg-card border border-border rounded-lg p-6">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2">
										{result.success ? (
											<CheckCircle2 className="h-5 w-5 text-green-500" />
										) : (
											<XCircle className="h-5 w-5 text-red-500" />
										)}
										<h2 className="text-lg font-medium text-foreground">Test Sonucu</h2>
									</div>
									{result.responseTime && (
										<span className="text-sm text-muted-foreground">
											{result.responseTime}ms
										</span>
									)}
								</div>

								<div className="space-y-4">
									<div className="flex items-center gap-3">
										<span className={`px-2 py-1 rounded text-xs font-medium ${
											result.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
										}`}>
											{result.status || "Error"}
										</span>
										<span className="text-sm text-foreground">{result.message}</span>
									</div>

									{result.productCount !== undefined && (
										<div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
											<Package className="h-5 w-5 text-primary" />
											<span className="text-foreground font-medium">{result.productCount.toLocaleString('tr-TR')}</span>
											<span className="text-muted-foreground">urun bulundu</span>
										</div>
									)}

									{result.data && (
										<div className="relative">
											<div className="flex items-center justify-between mb-2">
												<span className="text-sm text-muted-foreground">Ornek urun verisi (ilk 2 urun)</span>
												<button
													onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))}
													className="p-1 hover:bg-muted rounded transition-colors"
												>
													<Copy className="h-4 w-4 text-muted-foreground" />
												</button>
											</div>
											<pre className="p-4 bg-muted rounded-lg text-xs text-foreground overflow-auto max-h-80">
												{typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
											</pre>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="space-y-6">
						<div className="bg-card border border-border rounded-lg p-6">
							<div className="flex items-center gap-2 mb-4">
								<Plug className="h-5 w-5 text-primary" />
								<h3 className="text-sm font-medium text-foreground">Degeras API</h3>
							</div>
							<p className="text-xs text-muted-foreground mb-4">
								Tedarikci urun verilerine erisim icin kullanilan API. Her kategori icin ayri endpoint bulunur.
							</p>
							<div className="space-y-2">
								<div className="flex justify-between text-xs">
									<span className="text-muted-foreground">Customer ID</span>
									<span className="text-foreground font-mono">2429</span>
								</div>
								<div className="flex justify-between text-xs">
									<span className="text-muted-foreground">Kategori Sayisi</span>
									<span className="text-foreground">{DEGERAS_CATEGORIES.length - 1}</span>
								</div>
							</div>
						</div>

						<div className="bg-card border border-border rounded-lg p-6">
							<h3 className="text-sm font-medium text-foreground mb-4">Kategoriler</h3>
							<div className="space-y-2">
								{DEGERAS_CATEGORIES.filter(c => c.id !== "all").map((category) => {
									const Icon = category.icon;
									return (
										<button
											key={category.id}
											onClick={() => {
												setSelectedCategory(category);
												setResult(null);
											}}
											className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
												selectedCategory.id === category.id
													? "bg-primary/10 text-primary"
													: "text-muted-foreground hover:text-foreground hover:bg-muted"
											}`}
										>
											<Icon className="h-4 w-4" />
											{category.name}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
