"use client";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import Link from "next/link";

export default function Dashboard({
	session,
}: {
	session: typeof authClient.$Infer.Session;
}) {
	const syncStats = useQuery(trpc.products.syncStats.queryOptions());
	const settingsData = useQuery(trpc.settings.get.queryOptions());
	const shopifyConfig = useQuery(trpc.settings.shopifyConfig.queryOptions());
	const supplierConfig = useQuery(trpc.settings.supplierConfig.queryOptions());

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{/* Stats Cards */}
			<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-purple-300 mb-4">Senkronizasyon İstatistikleri</h3>
				<div className="space-y-2">
					<div className="flex justify-between">
						<span className="text-slate-400">Toplam Ürün:</span>
						<span className="font-bold text-white">{syncStats.data?.totalProducts || 0}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Senkronize:</span>
						<span className="font-bold text-green-400">{syncStats.data?.bySyncStatus.synced || 0}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Bekliyor:</span>
						<span className="font-bold text-yellow-400">{syncStats.data?.bySyncStatus.pending || 0}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Hatalı:</span>
						<span className="font-bold text-red-400">{syncStats.data?.bySyncStatus.failed || 0}</span>
					</div>
				</div>
			</div>

			{/* Category Stats */}
			<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-purple-300 mb-4">Kategoriye Göre</h3>
				<div className="space-y-2">
					<div className="flex justify-between">
						<span className="text-slate-400">Lastik:</span>
						<span className="font-bold text-white">{syncStats.data?.byCategory.tire || 0}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Jant:</span>
						<span className="font-bold text-white">{syncStats.data?.byCategory.rim || 0}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Akü:</span>
						<span className="font-bold text-white">{syncStats.data?.byCategory.battery || 0}</span>
					</div>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-purple-300 mb-4">Hızlı İşlemler</h3>
				<div className="space-y-3">
					<Link 
						href="/dashboard/sync" 
						className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-lg text-center transition-all duration-200"
					>
						Senkronizasyon Başlat
					</Link>
					<Link 
						href="/dashboard/pricing-rules" 
						className="block w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-2 px-4 rounded-lg text-center transition-all duration-200"
					>
						Fiyat Kuralları
					</Link>
					<Link 
						href="/dashboard/products" 
						className="block w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-2 px-4 rounded-lg text-center transition-all duration-200"
					>
						Ürünler
					</Link>
				</div>
			</div>

			{/* Shopify Config Status */}
			<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-purple-300 mb-4">Shopify Durumu</h3>
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<div className={`w-3 h-3 rounded-full ${shopifyConfig.data?.configured ? 'bg-green-500' : 'bg-red-500'}`} />
						<span className="text-slate-400">
							{shopifyConfig.data?.configured ? 'Bağlı' : 'Bağlı Değil'}
						</span>
					</div>
					{shopifyConfig.data?.shopDomain && (
						<p className="text-sm text-slate-500 truncate">{shopifyConfig.data.shopDomain}</p>
					)}
					<p className="text-xs text-slate-600">API: {shopifyConfig.data?.apiVersion}</p>
				</div>
			</div>

			{/* Supplier Config Status */}
			<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-purple-300 mb-4">Tedarikçi Durumu</h3>
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<div className={`w-3 h-3 rounded-full ${supplierConfig.data?.configured ? 'bg-green-500' : 'bg-yellow-500'}`} />
						<span className="text-slate-400">
							{supplierConfig.data?.useMock ? 'Mock Mod' : 'Gerçek API'}
						</span>
					</div>
					{supplierConfig.data?.apiUrl && (
						<p className="text-sm text-slate-500 truncate">{supplierConfig.data.apiUrl}</p>
					)}
				</div>
			</div>

			{/* Settings Summary */}
			<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-purple-300 mb-4">Ayarlar</h3>
				<div className="space-y-2 text-sm">
					<div className="flex justify-between">
						<span className="text-slate-400">Sync Mod:</span>
						<span className="text-white font-medium">{settingsData.data?.settings.syncMode || 'N/A'}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Batch Size:</span>
						<span className="text-white font-medium">{settingsData.data?.settings.batchSize || 0}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-slate-400">Max Retries:</span>
						<span className="text-white font-medium">{settingsData.data?.settings.maxRetries || 0}</span>
					</div>
					<Link 
						href="/dashboard/settings" 
						className="block text-purple-400 hover:text-purple-300 text-center mt-4 underline"
					>
						Ayarları Düzenle
					</Link>
				</div>
			</div>
		</div>
	);
}
