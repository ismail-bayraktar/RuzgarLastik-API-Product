"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import Link from "next/link";
import { Package, Circle, Disc3, Battery, Loader2, RefreshCw } from "lucide-react";

export default function ProductsPage() {
	const products = useQuery(trpc.products.list.queryOptions({ limit: 50, offset: 0 }));
	const stats = useQuery(trpc.products.syncStats.queryOptions());

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "tire":
				return <Circle className="h-3 w-3" />;
			case "rim":
				return <Disc3 className="h-3 w-3" />;
			case "battery":
				return <Battery className="h-3 w-3" />;
			default:
				return <Package className="h-3 w-3" />;
		}
	};

	const getCategoryLabel = (category: string) => {
		switch (category) {
			case "tire":
				return "Lastik";
			case "rim":
				return "Jant";
			case "battery":
				return "Aku";
			default:
				return category;
		}
	};

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">Urunler</h1>
					<p className="text-muted-foreground mt-1">Senkronize edilen urunleri goruntuleyın</p>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<StatCard label="Toplam" value={stats.data?.totalProducts || 0} />
					<StatCard label="Lastik" value={stats.data?.byCategory.tire || 0} color="green" />
					<StatCard label="Jant" value={stats.data?.byCategory.rim || 0} color="blue" />
					<StatCard label="Aku" value={stats.data?.byCategory.battery || 0} color="yellow" />
				</div>

				<div className="bg-card border border-border rounded-lg overflow-hidden">
					<div className="p-4 border-b border-border flex items-center justify-between">
						<h2 className="text-sm font-medium text-foreground">Urun Listesi</h2>
						<button
							onClick={() => products.refetch()}
							className="p-2 hover:bg-muted rounded-lg transition-colors"
						>
							<RefreshCw className={`h-4 w-4 text-muted-foreground ${products.isFetching ? 'animate-spin' : ''}`} />
						</button>
					</div>
					
					{products.isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : products.data?.products.length === 0 ? (
						<div className="text-center py-12">
							<Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
							<p className="text-muted-foreground mb-4">Henuz senkronize edilmis urun yok</p>
							<Link
								href="/dashboard/sync"
								className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
							>
								<RefreshCw className="h-4 w-4" />
								Senkronizasyon Baslat
							</Link>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-muted/50">
									<tr>
										<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Kategori</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Shopify ID</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Son Sync</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{products.data?.products.map((product: { sku: string; category: string; shopifyId?: string; lastSyncAt?: string }, i: number) => (
										<tr key={i} className="hover:bg-muted/30 transition-colors">
											<td className="px-4 py-3 text-sm font-mono text-foreground">{product.sku}</td>
											<td className="px-4 py-3">
												<span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
													product.category === 'tire' ? 'bg-green-500/10 text-green-500' :
													product.category === 'rim' ? 'bg-blue-500/10 text-blue-500' :
													'bg-yellow-500/10 text-yellow-500'
												}`}>
													{getCategoryIcon(product.category)}
													{getCategoryLabel(product.category)}
												</span>
											</td>
											<td className="px-4 py-3 text-sm text-muted-foreground font-mono">{product.shopifyId || '-'}</td>
											<td className="px-4 py-3 text-sm text-muted-foreground">{product.lastSyncAt || '-'}</td>
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

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
	const colorClasses = {
		green: "text-green-500",
		blue: "text-blue-500",
		yellow: "text-yellow-500",
	};

	return (
		<div className="bg-card border border-border rounded-lg p-4">
			<p className="text-xs text-muted-foreground mb-1">{label}</p>
			<p className={`text-2xl font-semibold ${color ? colorClasses[color as keyof typeof colorClasses] : 'text-foreground'}`}>
				{value}
			</p>
		</div>
	);
}
