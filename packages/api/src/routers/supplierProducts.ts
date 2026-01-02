import { protectedProcedure, router } from "../index";
import { z } from "zod";

// Services will be imported at runtime
const getServices = async () => {
	const { fetchJobService } = await import("../../../../apps/web/src/services/fetchJobService");
	const { supplierProductService } = await import("../../../../apps/web/src/services/supplierProductService");
	const { jobSchedulerService } = await import("../../../../apps/web/src/services/jobSchedulerService");
	return { fetchJobService, supplierProductService, jobSchedulerService };
};

const categoryEnum = z.enum(["tire", "rim", "battery"]);

export const supplierProductsRouter = router({
	// ============ FETCH JOB ENDPOINTS ============

	/**
	 * Yeni fetch job başlat
	 */
	createFetchJob: protectedProcedure
		.input(
			z.object({
				categories: z.array(categoryEnum).optional(),
			}).optional()
		)
		.mutation(async ({ input }) => {
			const { fetchJobService } = await getServices();

			const jobId = await fetchJobService.createJob({
				categories: input?.categories,
				triggeredBy: "manual",
			});

			return {
				success: true,
				jobId,
				message: "Fetch job başlatıldı",
			};
		}),

	/**
	 * Aktif job durumu (polling için)
	 */
	activeJob: protectedProcedure.query(async () => {
		const { fetchJobService } = await getServices();
		const job = await fetchJobService.getActiveJob();
		return { job };
	}),

	/**
	 * Belirli job'ın detaylı durumu
	 */
	jobStatus: protectedProcedure
		.input(z.object({ jobId: z.number() }))
		.query(async ({ input }) => {
			const { fetchJobService } = await getServices();
			const job = await fetchJobService.getJobProgress(input.jobId);
			return { job };
		}),

	/**
	 * Job geçmişi
	 */
	jobHistory: protectedProcedure
		.input(z.object({ limit: z.number().default(10) }).optional())
		.query(async ({ input }) => {
			const { fetchJobService } = await getServices();
			const jobs = await fetchJobService.getJobHistory(input?.limit || 10);
			return { jobs };
		}),

	/**
	 * Job'ı iptal et
	 */
	cancelJob: protectedProcedure
		.input(z.object({ jobId: z.number() }))
		.mutation(async ({ input }) => {
			const { fetchJobService } = await getServices();
			await fetchJobService.cancelJob(input.jobId);
			return {
				success: true,
				message: "Job iptal edildi",
			};
		}),

	/**
	 * Manuel retry tetikle
	 */
	retryJob: protectedProcedure
		.input(z.object({ jobId: z.number() }))
		.mutation(async ({ input }) => {
			const { fetchJobService } = await getServices();
			await fetchJobService.retryJob(input.jobId);
			return {
				success: true,
				message: "Job tekrar başlatıldı",
			};
		}),

	// ============ SUPPLIER PRODUCT ENDPOINTS ============

	/**
	 * Ürün listesi (paginated, filtered)
	 */
	list: protectedProcedure
		.input(
			z.object({
				category: categoryEnum.optional(),
				brand: z.string().optional(),
				search: z.string().optional(),
				isActive: z.boolean().optional(),
				minPrice: z.number().optional(),
				maxPrice: z.number().optional(),
				inStock: z.boolean().optional(),
				page: z.number().default(1),
				pageSize: z.number().default(50),
				sortBy: z.string().default("updatedAt"),
				sortOrder: z.enum(["asc", "desc"]).default("desc"),
			}).optional()
		)
		.query(async ({ input }) => {
			const { supplierProductService } = await getServices();

			const result = await supplierProductService.list(
				{
					category: input?.category,
					brand: input?.brand,
					search: input?.search,
					isActive: input?.isActive,
					minPrice: input?.minPrice,
					maxPrice: input?.maxPrice,
					inStock: input?.inStock,
				},
				input?.page || 1,
				input?.pageSize || 50,
				input?.sortBy || "updatedAt",
				input?.sortOrder || "desc"
			);

			return {
				products: result.products.map(p => ({
					id: p.id,
					supplierSku: p.supplierSku,
					category: p.category,
					title: p.title,
					brand: p.brand,
					model: p.model,
					currentPrice: p.currentPrice,
					currentPriceFormatted: (p.currentPrice / 100).toFixed(2) + " TL",
					currentStock: p.currentStock,
					isActive: p.isActive,
					barcode: p.barcode,
					images: p.images,
					lastSeenAt: p.lastSeenAt,
					lastPriceChangeAt: p.lastPriceChangeAt,
					lastStockChangeAt: p.lastStockChangeAt,
					createdAt: p.createdAt,
					updatedAt: p.updatedAt,
				})),
				pagination: {
					total: result.total,
					page: result.page,
					pageSize: result.pageSize,
					totalPages: result.totalPages,
				},
			};
		}),

	/**
	 * Ürün detayı + fiyat geçmişi
	 */
	detail: protectedProcedure
		.input(z.object({ sku: z.string() }))
		.query(async ({ input }) => {
			const { supplierProductService } = await getServices();
			const result = await supplierProductService.getDetail(input.sku);

			if (!result) {
				return { product: null, history: [] };
			}

			return {
				product: {
					...result.product,
					currentPriceFormatted: (result.product.currentPrice / 100).toFixed(2) + " TL",
				},
				history: result.history.map(h => ({
					...h,
					oldPriceFormatted: h.oldPrice ? (h.oldPrice / 100).toFixed(2) + " TL" : null,
					newPriceFormatted: h.newPrice ? (h.newPrice / 100).toFixed(2) + " TL" : null,
				})),
			};
		}),

	/**
	 * Kategori bazlı istatistikler
	 */
	stats: protectedProcedure.query(async () => {
		const { supplierProductService } = await getServices();

		const [categoryStats, overallStats] = await Promise.all([
			supplierProductService.getStats(),
			supplierProductService.getOverallStats(),
		]);

		return {
			categories: categoryStats.map(s => ({
				...s,
				avgPriceFormatted: (s.avgPrice / 100).toFixed(2) + " TL",
				totalValueFormatted: (s.totalValue / 100).toLocaleString("tr-TR") + " TL",
			})),
			overall: {
				...overallStats,
				avgPriceFormatted: (overallStats.avgPrice / 100).toFixed(2) + " TL",
				totalValueFormatted: (overallStats.totalValue / 100).toLocaleString("tr-TR") + " TL",
			},
		};
	}),

	/**
	 * Marka listesi
	 */
	brands: protectedProcedure
		.input(z.object({ category: categoryEnum.optional() }).optional())
		.query(async ({ input }) => {
			const { supplierProductService } = await getServices();
			const brands = await supplierProductService.getBrands(input?.category);
			return { brands };
		}),

	/**
	 * Son değişiklikler
	 */
	recentChanges: protectedProcedure
		.input(z.object({ limit: z.number().default(50) }).optional())
		.query(async ({ input }) => {
			const { supplierProductService } = await getServices();
			const changes = await supplierProductService.getRecentChanges(input?.limit || 50);

			return {
				changes: changes.map(c => ({
					...c,
					oldPriceFormatted: c.oldPrice ? (c.oldPrice / 100).toFixed(2) + " TL" : null,
					newPriceFormatted: c.newPrice ? (c.newPrice / 100).toFixed(2) + " TL" : null,
				})),
			};
		}),

	/**
	 * Scheduler durumu
	 */
	schedulerStatus: protectedProcedure.query(async () => {
		const { jobSchedulerService } = await getServices();
		return jobSchedulerService.getStatus();
	}),
});
