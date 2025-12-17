"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.settings.get.queryOptions());
	const shopifyConfig = useQuery(trpc.settings.shopifyConfig.queryOptions());
	const supplierConfig = useQuery(trpc.settings.supplierConfig.queryOptions());

	const [formData, setFormData] = useState({
		batchSize: 50,
		syncConcurrency: 5,
		maxRetries: 3,
		syncMode: "incremental" as "incremental" | "full",
		useMockSupplier: true,
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
						<h2 className="text-lg font-medium text-foreground mb-4">Shopify Baglantisi</h2>
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<div className={`w-2 h-2 rounded-full ${shopifyConfig.data?.configured ? 'bg-green-500' : 'bg-red-500'}`} />
								<span className="text-sm text-foreground">{shopifyConfig.data?.configured ? 'Bagli' : 'Bagli Degil'}</span>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<label className="text-xs text-muted-foreground">Shop Domain</label>
									<p className="text-sm font-mono text-foreground">{shopifyConfig.data?.shopDomain || 'Ayarlanmamis'}</p>
								</div>
								<div>
									<label className="text-xs text-muted-foreground">API Version</label>
									<p className="text-sm font-mono text-foreground">{shopifyConfig.data?.apiVersion}</p>
								</div>
								<div>
									<label className="text-xs text-muted-foreground">Location ID</label>
									<p className="text-sm font-mono text-foreground truncate">{shopifyConfig.data?.locationId || 'Ayarlanmamis'}</p>
								</div>
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
