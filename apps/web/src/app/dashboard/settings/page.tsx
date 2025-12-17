"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Loader2, ExternalLink, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.settings.get.queryOptions());
	const shopifyConfig = useQuery(trpc.settings.shopifyConfig.queryOptions());
	const supplierConfig = useQuery(trpc.settings.supplierConfig.queryOptions());
	
	const [showAccessToken, setShowAccessToken] = useState(false);

	const [formData, setFormData] = useState({
		batchSize: 50,
		syncConcurrency: 5,
		maxRetries: 3,
		syncMode: "incremental" as "incremental" | "full",
		useMockSupplier: true,
	});
	
	const [shopifyFormData, setShopifyFormData] = useState({
		shopDomain: "",
		accessToken: "",
		locationId: "",
		apiVersion: "2024-10",
	});

	useEffect(() => {
		if (settings.data) {
			setFormData({
				batchSize: settings.data.settings.batchSize || 50,
				syncConcurrency: settings.data.settings.syncConcurrency || 5,
				maxRetries: settings.data.settings.maxRetries || 3,
				syncMode: settings.data.settings.syncMode || "incremental",
				useMockSupplier: true,
			});
		}
	}, [settings.data]);
	
	useEffect(() => {
		if (shopifyConfig.data) {
			setShopifyFormData({
				shopDomain: shopifyConfig.data.shopDomain || "",
				accessToken: "",
				locationId: shopifyConfig.data.locationId || "",
				apiVersion: shopifyConfig.data.apiVersion || "2024-10",
			});
		}
	}, [shopifyConfig.data]);

	const updateMutation = useMutation(trpc.settings.update.mutationOptions({
		onSuccess: () => {
			toast.success("Ayarlar kaydedildi");
			queryClient.invalidateQueries({ queryKey: ["settings"] });
		},
		onError: (error) => {
			toast.error(`Hata: ${error.message}`);
		},
	}));

	const handleSave = () => {
		updateMutation.mutate(formData);
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">Ayarlar</h1>
					<p className="text-muted-foreground mt-1">Sistem yapilandirmasi ve baglantilar</p>
				</div>

				<div className="space-y-6">
					<div className="bg-card border border-border rounded-lg p-6">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-lg font-medium text-foreground">Shopify Baglantisi</h2>
							<div className="flex items-center gap-2">
								{shopifyConfig.data?.configured ? (
									<span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-medium">
										<CheckCircle className="h-3.5 w-3.5" />
										Bagli
									</span>
								) : (
									<span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-medium">
										<XCircle className="h-3.5 w-3.5" />
										Bagli Degil
									</span>
								)}
							</div>
						</div>
						
						<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
							<div className="flex gap-3">
								<AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
								<div>
									<p className="text-sm text-amber-500 font-medium">Guvenlik Notu</p>
									<p className="text-xs text-amber-500/80 mt-1">Shopify API bilgileri sunucu tarafinda .env dosyasinda saklanir. Bu bilgiler asla client&apos;a gonderilmez. Degisiklik yapmak icin sunucu .env dosyasini duzenleyin.</p>
								</div>
							</div>
						</div>
						
						<div className="space-y-4">
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Shop Domain</label>
								<input
									type="text"
									value={shopifyFormData.shopDomain}
									onChange={(e) => setShopifyFormData(prev => ({ ...prev, shopDomain: e.target.value }))}
									placeholder="ornek.myshopify.com"
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
								/>
								<p className="text-xs text-muted-foreground mt-1">Shopify mağaza adresi (.myshopify.com ile biter)</p>
							</div>
							
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Access Token</label>
								<div className="relative">
									<input
										type={showAccessToken ? "text" : "password"}
										value={shopifyFormData.accessToken}
										onChange={(e) => setShopifyFormData(prev => ({ ...prev, accessToken: e.target.value }))}
										placeholder="shpat_xxxxxxxxxxxxx"
										className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
									/>
									<button
										type="button"
										onClick={() => setShowAccessToken(!showAccessToken)}
										className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
									>
										{showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
								<p className="text-xs text-muted-foreground mt-1">Shopify Admin API access token (Custom App &gt; API credentials)</p>
							</div>
							
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm text-muted-foreground mb-2">Location ID</label>
									<input
										type="text"
										value={shopifyFormData.locationId}
										onChange={(e) => setShopifyFormData(prev => ({ ...prev, locationId: e.target.value }))}
										placeholder="gid://shopify/Location/12345"
										className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
									/>
									<p className="text-xs text-muted-foreground mt-1">Stok lokasyonu ID&apos;si</p>
								</div>
								<div>
									<label className="block text-sm text-muted-foreground mb-2">API Version</label>
									<select
										value={shopifyFormData.apiVersion}
										onChange={(e) => setShopifyFormData(prev => ({ ...prev, apiVersion: e.target.value }))}
										className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
									>
										<option value="2024-10">2024-10 (Stable)</option>
										<option value="2024-07">2024-07</option>
										<option value="2024-04">2024-04</option>
										<option value="2024-01">2024-01</option>
									</select>
								</div>
							</div>
							
							<div className="pt-4 border-t border-border">
								<p className="text-xs text-muted-foreground mb-3">Bu bilgileri kaydetmek icin sunucu .env dosyanıza ekleyin:</p>
								<pre className="bg-background border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
{`SHOPIFY_SHOP_DOMAIN=${shopifyFormData.shopDomain || "ornek.myshopify.com"}
SHOPIFY_ACCESS_TOKEN=${shopifyFormData.accessToken ? "***gizli***" : "shpat_xxxxx"}
SHOPIFY_LOCATION_ID=${shopifyFormData.locationId || "gid://shopify/Location/xxxxx"}
SHOPIFY_API_VERSION=${shopifyFormData.apiVersion}`}
								</pre>
							</div>
							
							<div className="flex items-center gap-3 pt-2">
								<a
									href="https://admin.shopify.com/store"
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition"
								>
									<ExternalLink className="h-4 w-4" />
									Shopify Admin
								</a>
								<a
									href="https://shopify.dev/docs/api/admin-graphql"
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition"
								>
									<ExternalLink className="h-4 w-4" />
									API Dokumantasyonu
								</a>
							</div>
						</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-lg font-medium text-foreground mb-4">Tedarikci API</h2>
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<div className={`w-2 h-2 rounded-full ${supplierConfig.data?.useMock ? 'bg-yellow-500' : supplierConfig.data?.configured ? 'bg-green-500' : 'bg-red-500'}`} />
								<span className="text-sm text-foreground">{supplierConfig.data?.useMock ? 'Mock Mod' : supplierConfig.data?.configured ? 'Gercek API' : 'Yapilandirilmamis'}</span>
							</div>
							{supplierConfig.data?.apiUrl && (
								<div>
									<label className="text-xs text-muted-foreground">API URL</label>
									<p className="text-sm font-mono text-foreground">{supplierConfig.data.apiUrl}</p>
								</div>
							)}
						</div>
					</div>

					<div className="bg-card border border-border rounded-lg p-6">
						<h2 className="text-lg font-medium text-foreground mb-6">Senkronizasyon Ayarlari</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Batch Size</label>
								<input
									type="number"
									min={10}
									max={200}
									value={formData.batchSize}
									onChange={(e) => setFormData(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 50 }))}
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
								/>
								<p className="text-xs text-muted-foreground mt-1">10-200 arasi</p>
							</div>
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Concurrency</label>
								<input
									type="number"
									min={1}
									max={10}
									value={formData.syncConcurrency}
									onChange={(e) => setFormData(prev => ({ ...prev, syncConcurrency: parseInt(e.target.value) || 5 }))}
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
								/>
								<p className="text-xs text-muted-foreground mt-1">1-10 arasi</p>
							</div>
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Max Retries</label>
								<input
									type="number"
									min={1}
									max={5}
									value={formData.maxRetries}
									onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 3 }))}
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
								/>
								<p className="text-xs text-muted-foreground mt-1">1-5 arasi</p>
							</div>
							<div>
								<label className="block text-sm text-muted-foreground mb-2">Sync Mode</label>
								<select
									value={formData.syncMode}
									onChange={(e) => setFormData(prev => ({ ...prev, syncMode: e.target.value as "incremental" | "full" }))}
									className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
								>
									<option value="incremental">Incremental</option>
									<option value="full">Full</option>
								</select>
							</div>
						</div>

						<div className="mt-6 flex items-center gap-3">
							<input
								type="checkbox"
								id="useMock"
								checked={formData.useMockSupplier}
								onChange={(e) => setFormData(prev => ({ ...prev, useMockSupplier: e.target.checked }))}
								className="w-4 h-4 rounded bg-background border-input text-primary focus:ring-ring"
							/>
							<label htmlFor="useMock" className="text-sm text-foreground">Mock Supplier kullan (test modu)</label>
						</div>

						<div className="mt-6 pt-6 border-t border-border">
							<button
								onClick={handleSave}
								disabled={updateMutation.isPending}
								className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
							>
								{updateMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
								{updateMutation.isPending ? 'Kaydediliyor...' : 'Ayarlari Kaydet'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
