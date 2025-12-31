import { db, eq, and, desc, asc, sqlFn } from "@my-better-t-app/db";
import {
	supplierProducts,
	supplierProductHistory,
	type SupplierProduct,
	type NewSupplierProduct,
	type ProductCategory
} from "@my-better-t-app/db/schema";

export interface ProductListFilters {
	category?: ProductCategory;
	brand?: string;
	search?: string;
	isActive?: boolean;
	minPrice?: number;
	maxPrice?: number;
	inStock?: boolean;
}

export interface ProductListResult {
	products: SupplierProduct[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface ProductWithHistory {
	product: SupplierProduct;
	history: {
		id: number;
		changeType: string;
		oldPrice: number | null;
		oldStock: number | null;
		newPrice: number | null;
		newStock: number | null;
		recordedAt: Date | null;
	}[];
}

export interface CategoryStats {
	category: string;
	totalProducts: number;
	activeProducts: number;
	totalValue: number; // Toplam değer (kuruş)
	avgPrice: number;
	inStockCount: number;
	outOfStockCount: number;
	lastUpdated: Date | null;
}

export class SupplierProductService {
	/**
	 * Tedarikçiden gelen ürünleri veritabanına toplu olarak kaydeder veya günceller (Upsert).
	 * Değişiklik tespit edildiğinde geçmiş (history) kaydı oluşturur.
	 */
	async upsertMany(
		products: any[], 
		category: ProductCategory, 
		jobId?: number
	): Promise<{
		created: number;
		updated: number;
		unchanged: number;
		failed: number;
	}> {
		let created = 0;
		let updated = 0;
		let unchanged = 0;
		let failed = 0;

		for (const p of products) {
			try {
				const sku = String(p.supplierSku);
				
				// Mevcut ürünü bul
				const existing = await db.query.supplierProducts.findFirst({
					where: eq(supplierProducts.supplierSku, sku),
				});

				const now = new Date();
				const currentPrice = Math.round(p.price * 100); // Kuruş cinsinden
				const currentStock = p.stock;

				if (!existing) {
					// Yeni ürün ekle
					await db.insert(supplierProducts).values({
						supplierSku: sku,
						category: category,
						title: p.title,
						brand: p.brand,
						model: p.model,
						currentPrice: currentPrice,
						currentStock: currentStock,
						barcode: p.barcode,
						description: p.description,
						images: p.images || [],
						metafields: p.metafields || {},
						rawApiData: p.metafields || p, // Ham veri
						firstSeenAt: now,
						lastSeenAt: now,
						isActive: true,
						validationStatus: "raw"
					});

					// İlk geçmiş kaydı
					await db.insert(supplierProductHistory).values({
						supplierSku: sku,
						changeType: "new",
						newPrice: currentPrice,
						newStock: currentStock,
						fetchJobId: jobId,
						recordedAt: now
					});

					created++;
				} else {
					// Değişiklik kontrolü
					const priceChanged = existing.currentPrice !== currentPrice;
					const stockChanged = existing.currentStock !== currentStock;

					if (priceChanged || stockChanged) {
						let changeType: "price" | "stock" | "both" = "both";
						if (priceChanged && !stockChanged) changeType = "price";
						if (!priceChanged && stockChanged) changeType = "stock";

						// Güncelle
						await db.update(supplierProducts)
							.set({
								title: p.title,
								currentPrice: currentPrice,
								currentStock: currentStock,
								lastSeenAt: now,
								lastPriceChangeAt: priceChanged ? now : existing.lastPriceChangeAt,
								lastStockChangeAt: stockChanged ? now : existing.lastStockChangeAt,
								updatedAt: now,
								rawApiData: p.metafields || p,
								isActive: true, // Tekrar görüldüğü için aktif yap
								validationStatus: "raw" // Reset validation on data change
							})
							.where(eq(supplierProducts.supplierSku, sku));

						// Geçmiş kaydı
						await db.insert(supplierProductHistory).values({
							supplierSku: sku,
							changeType: changeType,
							oldPrice: existing.currentPrice,
							newPrice: currentPrice,
							oldStock: existing.currentStock,
							newStock: currentStock,
							fetchJobId: jobId,
							recordedAt: now
						});

						updated++;
					} else {
						// Değişiklik yok, sadece görülme zamanını güncelle
						await db.update(supplierProducts)
							.set({ lastSeenAt: now, updatedAt: now, isActive: true })
							.where(eq(supplierProducts.supplierSku, sku));
						
						unchanged++;
					}
				}
			} catch (err) {
				console.error(`Failed to upsert product ${p.supplierSku}:`, err);
				failed++;
			}
		}

		return { created, updated, unchanged, failed };
	}

	/**
	 * Ürün listesi (filtrelenmiş ve sayfalanmış)
	 */
	async list(
		filters: ProductListFilters = {},
		page: number = 1,
		pageSize: number = 50,
		sortBy: string = "updatedAt",
		sortOrder: "asc" | "desc" = "desc"
	): Promise<ProductListResult> {
		const conditions: any[] = [];

		if (filters.category) {
			conditions.push(eq(supplierProducts.category, filters.category));
		}

		if (filters.brand) {
			conditions.push(eq(supplierProducts.brand, filters.brand));
		}

		if (filters.isActive !== undefined) {
			conditions.push(eq(supplierProducts.isActive, filters.isActive));
		}

		if (filters.inStock === true) {
			conditions.push(sqlFn`${supplierProducts.currentStock} > 0`);
		} else if (filters.inStock === false) {
			conditions.push(eq(supplierProducts.currentStock, 0));
		}

		if (filters.minPrice !== undefined) {
			conditions.push(sqlFn`${supplierProducts.currentPrice} >= ${filters.minPrice * 100}`);
		}

		if (filters.maxPrice !== undefined) {
			conditions.push(sqlFn`${supplierProducts.currentPrice} <= ${filters.maxPrice * 100}`);
		}

		if (filters.search) {
			const searchTerm = `%${filters.search}%`;
			conditions.push(
				sqlFn`(
					${supplierProducts.title} ILIKE ${searchTerm} OR
					${supplierProducts.supplierSku} ILIKE ${searchTerm} OR
					${supplierProducts.brand} ILIKE ${searchTerm} OR
					${supplierProducts.barcode} ILIKE ${searchTerm}
				)`
			);
		}

		const countResult = await db
			.select({ count: sqlFn<number>`count(*)::int` })
			.from(supplierProducts)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		const total = countResult[0]?.count || 0;

		const getSortColumn = () => {
			switch (sortBy) {
				case "title": return supplierProducts.title;
				case "brand": return supplierProducts.brand;
				case "currentPrice": return supplierProducts.currentPrice;
				case "currentStock": return supplierProducts.currentStock;
				case "createdAt": return supplierProducts.createdAt;
				case "lastSeenAt": return supplierProducts.lastSeenAt;
				default: return supplierProducts.updatedAt;
			}
		};

		const products = await db.query.supplierProducts.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			orderBy: sortOrder === "asc" ? asc(getSortColumn()) : desc(getSortColumn()),
			limit: pageSize,
			offset: (page - 1) * pageSize,
		});

		return {
			products,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize),
		};
	}

	/**
	 * Ürün detayı (geçmişi ile birlikte)
	 */
	async getDetail(sku: string, historyLimit: number = 20): Promise<ProductWithHistory | null> {
		const product = await db.query.supplierProducts.findFirst({
			where: eq(supplierProducts.supplierSku, sku),
		});

		if (!product) return null;

		const history = await db.query.supplierProductHistory.findMany({
			where: eq(supplierProductHistory.supplierSku, sku),
			orderBy: desc(supplierProductHistory.recordedAt),
			limit: historyLimit,
		});

		return {
			product,
			history: history.map(h => ({
				id: h.id,
				changeType: h.changeType,
				oldPrice: h.oldPrice,
				oldStock: h.oldStock,
				newPrice: h.newPrice,
				newStock: h.newStock,
				recordedAt: h.recordedAt,
			})),
		};
	}

	/**
	 * Kategori bazlı istatistikler
	 */
	async getStats(): Promise<CategoryStats[]> {
		const categories: ProductCategory[] = ["tire", "rim", "battery"];
		const stats: CategoryStats[] = [];

		for (const category of categories) {
			const result = await db
				.select({
					totalProducts: sqlFn<number>`count(*)::int`,
					activeProducts: sqlFn<number>`count(*) FILTER (WHERE ${supplierProducts.isActive} = true)::int`,
					totalValue: sqlFn<number>`COALESCE(sum(${supplierProducts.currentPrice}), 0)::bigint`,
					avgPrice: sqlFn<number>`COALESCE(avg(${supplierProducts.currentPrice}), 0)::int`,
					inStockCount: sqlFn<number>`count(*) FILTER (WHERE ${supplierProducts.currentStock} > 0)::int`,
					outOfStockCount: sqlFn<number>`count(*) FILTER (WHERE ${supplierProducts.currentStock} = 0)::int`,
					lastUpdated: sqlFn<Date>`max(${supplierProducts.updatedAt})`,
				})
				.from(supplierProducts)
				.where(eq(supplierProducts.category, category));

			const row = result[0];

			stats.push({
				category,
				totalProducts: row?.totalProducts || 0,
				activeProducts: row?.activeProducts || 0,
				totalValue: Number(row?.totalValue || 0),
				avgPrice: row?.avgPrice || 0,
				inStockCount: row?.inStockCount || 0,
				outOfStockCount: row?.outOfStockCount || 0,
				lastUpdated: row?.lastUpdated || null,
			});
		}

		return stats;
	}

	/**
	 * Genel istatistikler (tüm kategoriler)
	 */
	async getOverallStats(): Promise<{
		totalProducts: number;
		activeProducts: number;
		totalValue: number;
		avgPrice: number;
		inStockCount: number;
		outOfStockCount: number;
		lastFetchAt: Date | null;
	}> {
		const result = await db
			.select({
				totalProducts: sqlFn<number>`count(*)::int`,
				activeProducts: sqlFn<number>`count(*) FILTER (WHERE ${supplierProducts.isActive} = true)::int`,
				totalValue: sqlFn<number>`COALESCE(sum(${supplierProducts.currentPrice}), 0)::bigint`,
				avgPrice: sqlFn<number>`COALESCE(avg(${supplierProducts.currentPrice}), 0)::int`,
				inStockCount: sqlFn<number>`count(*) FILTER (WHERE ${supplierProducts.currentStock} > 0)::int`,
				outOfStockCount: sqlFn<number>`count(*) FILTER (WHERE ${supplierProducts.currentStock} = 0)::int`,
				lastFetchAt: sqlFn<Date>`max(${supplierProducts.lastSeenAt})`,
			})
			.from(supplierProducts);

		const row = result[0];

		return {
			totalProducts: row?.totalProducts || 0,
			activeProducts: row?.activeProducts || 0,
			totalValue: Number(row?.totalValue || 0),
			avgPrice: row?.avgPrice || 0,
			inStockCount: row?.inStockCount || 0,
			outOfStockCount: row?.outOfStockCount || 0,
			lastFetchAt: row?.lastFetchAt || null,
		};
	}

	/**
	 * Marka listesi
	 */
	async getBrands(category?: ProductCategory): Promise<string[]> {
		const result = await db
			.selectDistinct({ brand: supplierProducts.brand })
			.from(supplierProducts)
			.where(
				and(
					category ? eq(supplierProducts.category, category) : undefined,
					sqlFn`${supplierProducts.brand} IS NOT NULL AND ${supplierProducts.brand} != ''`
				)
			)
			.orderBy(asc(supplierProducts.brand));

		return result.map(r => r.brand).filter((b): b is string => b !== null);
	}

	/**
	 * Son değişiklikler
	 */
	async getRecentChanges(limit: number = 50): Promise<{
		sku: string;
		title: string;
		changeType: string;
		oldPrice: number | null;
		newPrice: number | null;
		oldStock: number | null;
		newStock: number | null;
		recordedAt: Date | null;
	}[]> {
		const changes = await db.query.supplierProductHistory.findMany({
			orderBy: desc(supplierProductHistory.recordedAt),
			limit,
		});

		const skus = [...new Set(changes.map(c => c.supplierSku))];
		if (skus.length === 0) return [];

		const products = await db.query.supplierProducts.findMany({
			where: sqlFn`${supplierProducts.supplierSku} IN (${skus.map(s => `'${s}'`).join(", ")})`,
		});

		const productMap = new Map(products.map(p => [p.supplierSku, p.title]));

		return changes.map(c => ({
			sku: c.supplierSku,
			title: productMap.get(c.supplierSku) || "Unknown",
			changeType: c.changeType,
			oldPrice: c.oldPrice,
			newPrice: c.newPrice,
			oldStock: c.oldStock,
			newStock: c.newStock,
			recordedAt: c.recordedAt,
		}));
	}
}

export const supplierProductService = new SupplierProductService();