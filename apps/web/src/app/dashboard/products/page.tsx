"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import Link from "next/link";

export default function ProductsPage() {
	const products = useQuery(trpc.products.list.queryOptions({ limit: 50, offset: 0 }));
	const stats = useQuery(trpc.products.syncStats.queryOptions());

	return (
		<div className="text-white p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
						Ürünler
					</h1>
					<p className="text-slate-400 mt-1">Senkronize edilen ürünleri görüntüleyin</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
					<div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-4">
						<p className="text-slate-400 text-sm">Toplam</p>
						<p className="text-2xl font-bold">{stats.data?.totalProducts || 0}</p>
					</div>
					<div className="bg-slate-800/50 border border-green-500/20 rounded-lg p-4">
						<p className="text-slate-400 text-sm">Lastik</p>
						<p className="text-2xl font-bold text-green-400">{stats.data?.byCategory.tire || 0}</p>
					</div>
					<div className="bg-slate-800/50 border border-blue-500/20 rounded-lg p-4">
						<p className="text-slate-400 text-sm">Jant</p>
						<p className="text-2xl font-bold text-blue-400">{stats.data?.byCategory.rim || 0}</p>
					</div>
					<div className="bg-slate-800/50 border border-yellow-500/20 rounded-lg p-4">
						<p className="text-slate-400 text-sm">Akü</p>
						<p className="text-2xl font-bold text-yellow-400">{stats.data?.byCategory.battery || 0}</p>
					</div>
				</div>

				<div className="bg-slate-800/50 border border-purple-500/20 rounded-lg overflow-hidden">
					<div className="p-4 border-b border-slate-700">
						<h2 className="text-lg font-semibold text-purple-300">Ürün Listesi</h2>
					</div>
					
					{products.isLoading ? (
						<div className="p-8 text-center text-slate-400">Yükleniyor...</div>
					) : products.data?.products.length === 0 ? (
						<div className="p-8 text-center">
							<p className="text-slate-400 mb-4">Henüz senkronize edilmiş ürün yok</p>
							<Link
								href="/dashboard/sync"
								className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition"
							>
								Senkronizasyon Başlat
							</Link>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-slate-700/50">
									<tr>
										<th className="px-4 py-3 text-left text-sm font-medium text-slate-300">SKU</th>
										<th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Kategori</th>
										<th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Shopify ID</th>
										<th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Son Sync</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-700">
									{products.data?.products.map((product: { sku: string; category: string; shopifyId?: string; lastSyncAt?: string }, i: number) => (
										<tr key={i} className="hover:bg-slate-700/30">
											<td className="px-4 py-3 text-sm">{product.sku}</td>
											<td className="px-4 py-3 text-sm">
												<span className={`px-2 py-1 rounded text-xs ${
													product.category === 'tire' ? 'bg-green-500/20 text-green-400' :
													product.category === 'rim' ? 'bg-blue-500/20 text-blue-400' :
													'bg-yellow-500/20 text-yellow-400'
												}`}>
													{product.category === 'tire' ? 'Lastik' : product.category === 'rim' ? 'Jant' : 'Akü'}
												</span>
											</td>
											<td className="px-4 py-3 text-sm text-slate-400">{product.shopifyId || '-'}</td>
											<td className="px-4 py-3 text-sm text-slate-400">{product.lastSyncAt || '-'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
