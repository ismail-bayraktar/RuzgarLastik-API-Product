import { db } from "@my-better-t-app/db";
import { productsCache, cacheMetadata } from "@my-better-t-app/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { SupplierService, SupplierProduct } from "./supplierService";

export class CacheService {
	private supplierService: SupplierService;
	private refreshIntervalHours = 24;

	constructor() {
		const useMock = process.env.USE_MOCK_SUPPLIER === "true";
		this.supplierService = new SupplierService({ useMock });
	}

	async getCachedProducts(options?: {
		category?: "tire" | "rim" | "battery";
		limit?: number;
		forceRefresh?: boolean;
	}): Promise<{ products: SupplierProduct[]; fromCache: boolean; lastFetchAt: Date | null }> {
		const { category, limit, forceRefresh = false } = options || {};

		if (!forceRefresh) {
			const cacheValid = await this.isCacheValid(category);
			if (cacheValid) {
				const cached = await this.getFromCache(category, limit);
				const metadata = await this.getCacheMetadata(category);
				return {
					products: cached,
					fromCache: true,
					lastFetchAt: metadata?.lastFetchAt || null,
				};
			}
		}

		const freshProducts = await this.refreshCache(category);
		const limited = limit ? freshProducts.slice(0, limit) : freshProducts;
		
		return {
			products: limited,
			fromCache: false,
			lastFetchAt: new Date(),
		};
	}

	async isCacheValid(category?: string): Promise<boolean> {
		const categories = category ? [category] : ["tire", "rim", "battery"];
		
		for (const cat of categories) {
			const metadata = await db
				.select()
				.from(cacheMetadata)
				.where(eq(cacheMetadata.category, cat))
				.limit(1);

			if (!metadata[0]?.lastFetchAt) return false;

			const hoursSinceLastFetch = 
				(Date.now() - new Date(metadata[0].lastFetchAt).getTime()) / (1000 * 60 * 60);
			
			const interval = metadata[0].refreshIntervalHours || this.refreshIntervalHours;
			
			if (hoursSinceLastFetch > interval) return false;
		}

		return true;
	}

	async getFromCache(category?: string, limit?: number): Promise<SupplierProduct[]> {
		let query = db.select().from(productsCache);
		
		if (category) {
			query = query.where(eq(productsCache.category, category)) as any;
		}

		if (limit) {
			query = query.limit(limit) as any;
		}

		const cached = await query;

		return cached.map((p) => ({
			supplierSku: p.supplierSku,
			title: p.title,
			brand: p.brand || "",
			model: p.model || "",
			category: p.category as "tire" | "rim" | "battery",
			price: p.price / 100,
			stock: p.stock,
			barcode: p.barcode || undefined,
			description: p.description || undefined,
			images: (p.images as string[]) || [],
			metafields: (p.metafields as Record<string, any>) || {},
		}));
	}

	async refreshCache(category?: "tire" | "rim" | "battery"): Promise<SupplierProduct[]> {
		const categories: Array<"tire" | "rim" | "battery"> = category 
			? [category] 
			: ["tire", "rim", "battery"];

		const allProducts: SupplierProduct[] = [];

		for (const cat of categories) {
			await this.updateCacheMetadata(cat, { status: "fetching" });
			
			const startTime = Date.now();
			
			try {
				const response = await this.supplierService.getProducts({ category: cat, limit: 10000 });
				const products = response.products;
				
				await this.saveToCache(products, cat);
				
				const duration = Date.now() - startTime;
				await this.updateCacheMetadata(cat, {
					status: "idle",
					lastFetchAt: new Date(),
					productCount: products.length,
					fetchDurationMs: duration,
					errorMessage: null,
				});

				allProducts.push(...products);
			} catch (error: any) {
				const duration = Date.now() - startTime;
				await this.updateCacheMetadata(cat, {
					status: "error",
					fetchDurationMs: duration,
					errorMessage: error.message,
				});
				
				console.error(`Cache refresh failed for ${cat}:`, error.message);
				const cached = await this.getFromCache(cat);
				allProducts.push(...cached);
			}
		}

		return allProducts;
	}

	private async saveToCache(products: SupplierProduct[], category: string): Promise<void> {
		await db.delete(productsCache).where(eq(productsCache.category, category));

		if (products.length === 0) return;

		const batchSize = 100;
		for (let i = 0; i < products.length; i += batchSize) {
			const batch = products.slice(i, i + batchSize);
			
			await db.insert(productsCache).values(
				batch.map((p) => ({
					supplierSku: p.supplierSku,
					category: p.category,
					title: p.title,
					brand: p.brand || null,
					model: p.model || null,
					price: Math.round(p.price * 100),
					stock: p.stock,
					barcode: p.barcode || null,
					description: p.description || null,
					images: p.images || [],
					metafields: p.metafields || {},
					updatedAt: new Date(),
				}))
			).onConflictDoUpdate({
				target: productsCache.supplierSku,
				set: {
					title: sql`excluded.title`,
					brand: sql`excluded.brand`,
					model: sql`excluded.model`,
					price: sql`excluded.price`,
					stock: sql`excluded.stock`,
					barcode: sql`excluded.barcode`,
					description: sql`excluded.description`,
					images: sql`excluded.images`,
					metafields: sql`excluded.metafields`,
					updatedAt: sql`excluded.updated_at`,
				},
			});
		}
	}

	async getCacheMetadata(category?: string): Promise<{
		category: string;
		lastFetchAt: Date | null;
		productCount: number;
		status: string;
		errorMessage: string | null;
	} | null> {
		if (!category) {
			const all = await db.select().from(cacheMetadata);
			if (all.length === 0) return null;
			
			const oldest = all.reduce((a, b) => 
				(a.lastFetchAt || new Date(0)) < (b.lastFetchAt || new Date(0)) ? a : b
			);
			
			return {
				category: "all",
				lastFetchAt: oldest.lastFetchAt,
				productCount: all.reduce((sum, m) => sum + (m.productCount || 0), 0),
				status: all.some(m => m.status === "fetching") ? "fetching" : 
						all.some(m => m.status === "error") ? "error" : "idle",
				errorMessage: all.find(m => m.errorMessage)?.errorMessage || null,
			};
		}

		const metadata = await db
			.select()
			.from(cacheMetadata)
			.where(eq(cacheMetadata.category, category))
			.limit(1);

		if (!metadata[0]) return null;

		return {
			category: metadata[0].category,
			lastFetchAt: metadata[0].lastFetchAt,
			productCount: metadata[0].productCount || 0,
			status: metadata[0].status || "idle",
			errorMessage: metadata[0].errorMessage,
		};
	}

	private async updateCacheMetadata(
		category: string,
		data: {
			status?: string;
			lastFetchAt?: Date;
			productCount?: number;
			fetchDurationMs?: number;
			errorMessage?: string | null;
		}
	): Promise<void> {
		const existing = await db
			.select()
			.from(cacheMetadata)
			.where(eq(cacheMetadata.category, category))
			.limit(1);

		if (existing[0]) {
			await db
				.update(cacheMetadata)
				.set({ ...data, updatedAt: new Date() })
				.where(eq(cacheMetadata.category, category));
		} else {
			await db.insert(cacheMetadata).values({
				category,
				...data,
				updatedAt: new Date(),
			});
		}
	}

	async getAllCacheStatus(): Promise<{
		categories: Array<{
			category: string;
			lastFetchAt: Date | null;
			productCount: number;
			status: string;
			isStale: boolean;
		}>;
		totalProducts: number;
		oldestFetch: Date | null;
	}> {
		const metadata = await db.select().from(cacheMetadata);
		
		const categories = metadata.map((m) => ({
			category: m.category,
			lastFetchAt: m.lastFetchAt,
			productCount: m.productCount || 0,
			status: m.status || "idle",
			isStale: !m.lastFetchAt || 
				(Date.now() - new Date(m.lastFetchAt).getTime()) / (1000 * 60 * 60) > (m.refreshIntervalHours || 24),
		}));

		return {
			categories,
			totalProducts: categories.reduce((sum, c) => sum + c.productCount, 0),
			oldestFetch: categories.length > 0 
				? categories.reduce((oldest, c) => 
						(!oldest || (c.lastFetchAt && c.lastFetchAt < oldest)) ? c.lastFetchAt : oldest, 
						null as Date | null
					)
				: null,
		};
	}
}

export const cacheService = new CacheService();
