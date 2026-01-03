"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Package, Search, Filter, RefreshCw,
	ChevronDown, ExternalLink, History,
	TrendingUp, TrendingDown, Minus, X
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { FetchJobStatus } from "@/components/supplier/FetchJobStatus";
import { TableFilters, TablePagination } from "@/components/sync/TableFilters";

const categoryLabels: Record<string, string> = {
	tire: "Lastik",
	rim: "Jant",
	battery: "Akü",
};

const categoryEmojis: Record<string, string> = {
	tire: "🛞",
	rim: "🔘",
	battery: "🔋",
};

export default function SupplierProductsPage() {
	const queryClient = useQueryClient();
	// Filters state
	const [category, setCategory] = useState<"tire" | "rim" | "battery" | undefined>();
	const [brand, setBrand] = useState<string | undefined>();
	const [search, setSearch] = useState("");
	const [inStock, setInStock] = useState<boolean | undefined>();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [showFilters, setShowFilters] = useState(false);
	const [showColumnMenu, setShowColumnMenu] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

	// Column visibility
	const [columns, setColumns] = useState([
		{ id: "sku", label: "SKU", visible: true },
		{ id: "title", label: "Ürün", visible: true },
		{ id: "brand", label: "Marka", visible: true },
		{ id: "price", label: "Fiyat", visible: true },
		{ id: "stock", label: "Stok", visible: true },
		{ id: "category", label: "Kategori", visible: false },
		{ id: "lastSeen", label: "Son Görülme", visible: true },
		{ id: "priceChange", label: "Fiyat Değişimi", visible: false },
	]);

	// Queries
	const statsQuery = useQuery(trpc.supplierProducts.stats.queryOptions());
	const brandsQuery = useQuery(trpc.supplierProducts.brands.queryOptions({ category }));

	const productsQuery = useQuery(trpc.supplierProducts.list.queryOptions({
		category,
		brand,
		search: search || undefined,
		inStock,
		page,
		pageSize,
	}));

	const productDetailQuery = useQuery({
		...trpc.supplierProducts.detail.queryOptions({ sku: selectedProduct! }),
		enabled: !!selectedProduct
	});

	// Handle refetch after job complete
	const handleJobComplete = useCallback(() => {
		statsQuery.refetch();
		productsQuery.refetch();
	}, [statsQuery, productsQuery]);

	// Column toggle
	const toggleColumn = (columnId: string) => {
		setColumns(cols =>
			cols.map(col =>
				col.id === columnId ? { ...col, visible: !col.visible } : col
			)
		);
	};

	const stats = statsQuery.data;
	const products = productsQuery.data;
	const brands = brandsQuery.data?.brands || [];

	// Active filters
	const hasActiveFilters = !!(category || brand || inStock !== undefined || search);

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<Package className="h-6 w-6 text-primary" />
							Tedarikçi Ürünleri
						</h1>
						<p className="text-muted-foreground mt-1">
							Tedarikçiden çekilen ürünleri görüntüle ve yönet
						</p>
					</div>
				</div>

				{/* Fetch Job Status */}
				<FetchJobStatus onJobComplete={handleJobComplete} />

				{/* Stats Cards */}
				{stats && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Overall Stats */}
						<div className="bg-card border border-border rounded-lg p-4">
							<div className="flex items-center gap-2 mb-2">
								<div className="p-2 rounded-lg bg-primary/10">
									<Package className="h-4 w-4 text-primary" />
								</div>
								<span className="text-sm font-medium">Toplam Ürün</span>
							</div>
							<p className="text-2xl font-bold text-foreground">
								{stats.overall.totalProducts.toLocaleString("tr-TR")}
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								{stats.overall.inStockCount.toLocaleString("tr-TR")} stokta
							</p>
						</div>

						{/* Category Cards */}
						{stats.categories.map((cat) => (
							<div
								key={cat.category}
								className={`bg-card border rounded-lg p-4 cursor-pointer transition ${
									category === cat.category
										? "border-primary bg-primary/5"
										: "border-border hover:border-primary/50"
								}`}
								onClick={() => setCategory(
									category === cat.category ? undefined : cat.category as "tire" | "rim" | "battery"
								)}
							>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<span className="text-lg">{categoryEmojis[cat.category]}</span>
										<span className="text-sm font-medium">
											{categoryLabels[cat.category]}
										</span>
									</div>
									{category === cat.category && (
										<X className="h-4 w-4 text-primary" />
									)}
								</div>
								<p className="text-2xl font-bold text-foreground">
									{cat.totalProducts.toLocaleString("tr-TR")}
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Ort. {cat.avgPriceFormatted}
								</p>
							</div>
						))}
					</div>
				)}

				{/* Products Table */}
				<div className="bg-card border border-border rounded-lg overflow-hidden">
					{/* Table Filters */}
					<TableFilters
						searchQuery={search}
						onSearchChange={(val) => {
							setSearch(val);
							setPage(1);
						}}
						searchPlaceholder="SKU, ürün adı veya marka ara..."
						showFilters={showFilters}
						onToggleFilters={() => setShowFilters(!showFilters)}
						hasActiveFilters={hasActiveFilters}
						columns={columns}
						onToggleColumn={toggleColumn}
						showColumnMenu={showColumnMenu}
						onToggleColumnMenu={() => setShowColumnMenu(!showColumnMenu)}
						filterContent={
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								{/* Brand Filter */}
								<div>
									<label className="text-xs text-muted-foreground mb-1 block">
										Marka
									</label>
									<select
										value={brand || ""}
										onChange={(e) => {
											setBrand(e.target.value || undefined);
											setPage(1);
										}}
										className="w-full px-3 py-2 text-sm bg-muted border-0 rounded-lg"
									>
										<option value="">Tümü</option>
										{brands.map((b) => (
											<option key={b} value={b}>
												{b}
											</option>
										))}
									</select>
								</div>

								{/* Stock Filter */}
								<div>
									<label className="text-xs text-muted-foreground mb-1 block">
										Stok Durumu
									</label>
									<select
										value={inStock === undefined ? "" : inStock ? "in" : "out"}
										onChange={(e) => {
											setInStock(
												e.target.value === "" ? undefined :
												e.target.value === "in" ? true : false
											);
											setPage(1);
										}}
										className="w-full px-3 py-2 text-sm bg-muted border-0 rounded-lg"
									>
										<option value="">Tümü</option>
										<option value="in">Stokta</option>
										<option value="out">Stok Yok</option>
									</select>
								</div>

								{/* Clear Filters */}
								<div className="flex items-end">
									<button
										onClick={() => {
											setCategory(undefined);
											setBrand(undefined);
											setInStock(undefined);
											setSearch("");
											setPage(1);
										}}
										className="px-4 py-2 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
									>
										Filtreleri Temizle
									</button>
								</div>
							</div>
						}
					/>

					{/* Table */}
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-muted/50 border-b border-border">
								<tr>
									{columns.filter(c => c.visible).map((col) => (
										<th
											key={col.id}
											className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
										>
											{col.label}
										</th>
									))}
									<th className="px-4 py-3 w-10" />
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{productsQuery.isLoading ? (
									<tr>
										<td
											colSpan={columns.filter(c => c.visible).length + 1}
											className="px-4 py-8 text-center text-muted-foreground"
										>
											<RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
											Yükleniyor...
										</td>
									</tr>
								) : products?.products.length === 0 ? (
									<tr>
										<td
											colSpan={columns.filter(c => c.visible).length + 1}
											className="px-4 py-8 text-center text-muted-foreground"
										>
											{hasActiveFilters
												? "Filtrelerinize uygun ürün bulunamadı"
												: "Henüz ürün yok. Yukarıdan ürün çekmeyi başlatın."}
										</td>
									</tr>
								) : (
									products?.products.map((product) => (
										<tr
											key={product.id}
											className="hover:bg-muted/30 transition cursor-pointer"
											onClick={() => setSelectedProduct(product.supplierSku)}
										>
											{columns.find(c => c.id === "sku")?.visible && (
												<td className="px-4 py-3 text-sm font-mono text-muted-foreground">
													{product.supplierSku}
												</td>
											)}
											{columns.find(c => c.id === "title")?.visible && (
												<td className="px-4 py-3">
													<div className="text-sm font-medium text-foreground line-clamp-1">
														{product.title}
													</div>
												</td>
											)}
											{columns.find(c => c.id === "brand")?.visible && (
												<td className="px-4 py-3 text-sm text-foreground">
													{product.brand || "-"}
												</td>
											)}
											{columns.find(c => c.id === "price")?.visible && (
												<td className="px-4 py-3 text-sm font-medium text-foreground">
													{product.currentPriceFormatted}
												</td>
											)}
											{columns.find(c => c.id === "stock")?.visible && (
												<td className="px-4 py-3">
													<span className={`text-sm ${
														product.currentStock > 0
															? "text-green-600"
															: "text-red-500"
													}`}>
														{product.currentStock > 0
															? product.currentStock.toLocaleString("tr-TR")
															: "Stok Yok"}
													</span>
												</td>
											)}
											{columns.find(c => c.id === "category")?.visible && (
												<td className="px-4 py-3">
													<span className="text-xs px-2 py-1 bg-muted rounded">
														{categoryEmojis[product.category]} {categoryLabels[product.category]}
													</span>
												</td>
											)}
											{columns.find(c => c.id === "lastSeen")?.visible && (
												<td className="px-4 py-3 text-sm text-muted-foreground">
													{product.lastSeenAt
														? new Date(product.lastSeenAt).toLocaleDateString("tr-TR")
														: "-"}
												</td>
											)}
											{columns.find(c => c.id === "priceChange")?.visible && (
												<td className="px-4 py-3">
													{product.lastPriceChangeAt ? (
														<span className="text-xs text-muted-foreground">
															{new Date(product.lastPriceChangeAt).toLocaleDateString("tr-TR")}
														</span>
													) : (
														<span className="text-xs text-muted-foreground">-</span>
													)}
												</td>
											)}
											<td className="px-4 py-3">
												<button className="p-1 text-muted-foreground hover:text-foreground transition">
													<ChevronDown className="h-4 w-4" />
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{products && (
						<TablePagination
							currentPage={products.pagination.page}
							totalPages={products.pagination.totalPages}
							pageSize={products.pagination.pageSize}
							totalItems={products.pagination.total}
							startIndex={(products.pagination.page - 1) * products.pagination.pageSize}
							endIndex={products.pagination.page * products.pagination.pageSize}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					)}
				</div>

				{/* Product Detail Modal */}
				{selectedProduct && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
						<div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
							{/* Modal Header */}
							<div className="flex items-center justify-between p-4 border-b border-border">
								<h3 className="font-semibold text-foreground">Ürün Detayı</h3>
								<button
									onClick={() => setSelectedProduct(null)}
									className="p-1 text-muted-foreground hover:text-foreground transition"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							{/* Modal Content */}
							<div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
								{productDetailQuery.isLoading ? (
									<div className="text-center py-8">
										<RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
										Yükleniyor...
									</div>
								) : productDetailQuery.data?.product ? (
									<div className="space-y-6">
										{/* Product Info */}
										<div>
											<h4 className="text-lg font-medium text-foreground mb-2">
												{productDetailQuery.data.product.title}
											</h4>
											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<span className="text-muted-foreground">SKU:</span>{" "}
													<span className="font-mono">{productDetailQuery.data.product.supplierSku}</span>
												</div>
												<div>
													<span className="text-muted-foreground">Kategori:</span>{" "}
													{categoryLabels[productDetailQuery.data.product.category]}
												</div>
												<div>
													<span className="text-muted-foreground">Marka:</span>{" "}
													{productDetailQuery.data.product.brand || "-"}
												</div>
												<div>
													<span className="text-muted-foreground">Barkod:</span>{" "}
													{productDetailQuery.data.product.barcode || "-"}
												</div>
												<div>
													<span className="text-muted-foreground">Fiyat:</span>{" "}
													<span className="font-semibold text-foreground">
														{productDetailQuery.data.product.currentPriceFormatted}
													</span>
												</div>
												<div>
													<span className="text-muted-foreground">Stok:</span>{" "}
													<span className={productDetailQuery.data.product.currentStock > 0 ? "text-green-600" : "text-red-500"}>
														{productDetailQuery.data.product.currentStock}
													</span>
												</div>
											</div>
										</div>

										{/* Price History */}
										{productDetailQuery.data.history.length > 0 && (
											<div>
												<h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
													<History className="h-4 w-4" />
													Fiyat/Stok Geçmişi
												</h5>
												<div className="space-y-2 max-h-60 overflow-y-auto">
													{productDetailQuery.data.history.map((h) => (
														<div
															key={h.id}
															className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
														>
															<div className="flex items-center gap-2">
																{h.changeType === "price" && <TrendingUp className="h-4 w-4 text-blue-500" />}
																{h.changeType === "stock" && <Package className="h-4 w-4 text-purple-500" />}
																{h.changeType === "both" && <RefreshCw className="h-4 w-4 text-orange-500" />}
																{h.changeType === "new" && <TrendingUp className="h-4 w-4 text-green-500" />}
																<span className="text-muted-foreground">
																	{h.recordedAt
																		? new Date(h.recordedAt).toLocaleString("tr-TR")
																		: "-"}
																</span>
															</div>
															<div className="flex items-center gap-4 text-xs">
																{h.changeType !== "new" && h.oldPriceFormatted && (
																	<span className="text-muted-foreground line-through">
																		{h.oldPriceFormatted}
																	</span>
																)}
																{h.newPriceFormatted && (
																	<span className="font-medium">{h.newPriceFormatted}</span>
																)}
																{h.changeType === "stock" || h.changeType === "both" ? (
																	<span className="text-purple-600">
																		{h.oldStock} → {h.newStock}
																	</span>
																) : null}
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								) : (
									<div className="text-center py-8 text-muted-foreground">
										Ürün bulunamadı
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
