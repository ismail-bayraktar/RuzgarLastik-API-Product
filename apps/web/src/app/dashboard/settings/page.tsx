"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

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
		<div className="text-white p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
						Ayarlar
					</h1>
					<p className="text-slate-400 mt-1">Sistem yapılandırması ve bağlantılar</p>
				</div>

				<div className="space-y-6">
					<div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
						<h2 className="text-lg font-semibold text-purple-300 mb-4">Shopify Bağlantısı</h2>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className={`w-3 h-3 rounded-full ${shopifyConfig.data?.configured ? 'bg-green-500' : 'bg-red-500'}`} />
								<span>{shopifyConfig.data?.configured ? 'Bağlı' : 'Bağlı Değil'}</span>
							</div>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="text-slate-400">Shop Domain:</span>
									<p className="font-mono text-slate-300">{shopifyConfig.data?.shopDomain || 'Ayarlanmamış'}</p>
								</div>
								<div>
									<span className="text-slate-400">API Version:</span>
									<p className="font-mono text-slate-300">{shopifyConfig.data?.apiVersion}</p>
								</div>
								<div>
									<span className="text-slate-400">Location ID:</span>
									<p className="font-mono text-slate-300 truncate">{shopifyConfig.data?.locationId || 'Ayarlanmamış'}</p>
								</div>
							</div>
						</div>
					</div>

					<div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
						<h2 className="text-lg font-semibold text-purple-300 mb-4">Tedarikçi API</h2>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className={`w-3 h-3 rounded-full ${supplierConfig.data?.useMock ? 'bg-yellow-500' : supplierConfig.data?.configured ? 'bg-green-500' : 'bg-red-500'}`} />
								<span>{supplierConfig.data?.useMock ? 'Mock Mod' : supplierConfig.data?.configured ? 'Gerçek API' : 'Yapılandırılmamış'}</span>
							</div>
							{supplierConfig.data?.apiUrl && (
								<div className="text-sm">
									<span className="text-slate-400">API URL:</span>
									<p className="font-mono text-slate-300">{supplierConfig.data.apiUrl}</p>
								</div>
							)}
						</div>
					</div>

					<div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
						<h2 className="text-lg font-semibold text-purple-300 mb-4">Senkronizasyon Ayarları</h2>
						<div className="grid grid-cols-2 gap-6">
							<div>
								<label className="block text-sm text-slate-400 mb-2">Batch Size</label>
								<input
									type="number"
									min={10}
									max={200}
									value={formData.batchSize}
									onChange={(e) => setFormData(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 50 }))}
									className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								/>
								<p className="text-xs text-slate-500 mt-1">10-200 arası</p>
							</div>
							<div>
								<label className="block text-sm text-slate-400 mb-2">Concurrency</label>
								<input
									type="number"
									min={1}
									max={10}
									value={formData.syncConcurrency}
									onChange={(e) => setFormData(prev => ({ ...prev, syncConcurrency: parseInt(e.target.value) || 5 }))}
									className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								/>
								<p className="text-xs text-slate-500 mt-1">1-10 arası</p>
							</div>
							<div>
								<label className="block text-sm text-slate-400 mb-2">Max Retries</label>
								<input
									type="number"
									min={1}
									max={5}
									value={formData.maxRetries}
									onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 3 }))}
									className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								/>
								<p className="text-xs text-slate-500 mt-1">1-5 arası</p>
							</div>
							<div>
								<label className="block text-sm text-slate-400 mb-2">Sync Mode</label>
								<select
									value={formData.syncMode}
									onChange={(e) => setFormData(prev => ({ ...prev, syncMode: e.target.value as "incremental" | "full" }))}
									className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
								className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
							/>
							<label htmlFor="useMock" className="text-sm text-slate-300">Mock Supplier kullan (test modu)</label>
						</div>

						<div className="mt-6 pt-6 border-t border-slate-700">
							<button
								onClick={handleSave}
								disabled={updateMutation.isPending}
								className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
							>
								{updateMutation.isPending ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
