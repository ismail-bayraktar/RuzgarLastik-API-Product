import { db, eq, and, lte, desc, sqlFn } from "@my-better-t-app/db";
import {
	fetchJobs,
	supplierProducts,
	supplierProductHistory,
	type FetchJob,
	type FetchJobStatus,
	type ProductCategory
} from "@my-better-t-app/db/schema";
import { SupplierService, type SupplierProduct } from "./supplierService";

export interface FetchJobProgress {
	id: number;
	status: FetchJobStatus;
	jobType: string;
	categories: string[];

	// İlerleme
	totalCategories: number;
	completedCategories: number;
	currentCategory: string | null;
	productsFetched: number;
	productsCreated: number;
	productsUpdated: number;
	productsUnchanged: number;
	progressPercent: number;

	// Rate Limit
	retryCount: number;
	maxRetries: number;
	retryAfter: Date | null;
	rateLimitCategory: string | null;
	rateLimitWaitSeconds: number | null;
	secondsUntilRetry: number | null;

	// Zamanlama
	startedAt: Date | null;
	finishedAt: Date | null;
	triggeredBy: string | null;
	errorMessage: string | null;

	createdAt: Date | null;
}

export interface CreateJobInput {
	categories?: ProductCategory[];
	triggeredBy?: 'manual' | 'scheduled' | 'retry';
}

const BATCH_SIZE = 100;

export class FetchJobService {
	private supplierService: SupplierService;
	private isProcessing: boolean = false;

	constructor() {
		this.supplierService = new SupplierService({
			useMock: process.env.USE_MOCK_SUPPLIER === "true",
		});
	}

	/**
	 * Yeni fetch job oluştur
	 */
	async createJob(input: CreateJobInput = {}): Promise<number> {
		const categories = input.categories || ["tire", "rim", "battery"];

		// Aktif bir job varsa hata döndür
		const activeJob = await this.getActiveJob();
		if (activeJob) {
			throw new Error(`Aktif bir fetch job zaten var (ID: ${activeJob.id}). Lütfen tamamlanmasını bekleyin veya iptal edin.`);
		}

		const result = await db.insert(fetchJobs).values({
			jobType: categories.length === 3 ? "full_fetch" : "category_fetch",
			categories: categories,
			status: "pending",
			totalCategories: categories.length,
			completedCategories: 0,
			triggeredBy: input.triggeredBy || "manual",
		}).returning({ id: fetchJobs.id });

		const newJob = result[0];
		if (!newJob) {
			throw new Error("Failed to create fetch job");
		}

		// Job'ı hemen başlat (async)
		this.processJob(newJob.id).catch(err => {
			console.error(`[FetchJob ${newJob.id}] Processing error:`, err);
		});

		return newJob.id;
	}

	/**
	 * Job ilerlemesini getir
	 */
	async getJobProgress(jobId: number): Promise<FetchJobProgress | null> {
		const job = await db.query.fetchJobs.findFirst({
			where: eq(fetchJobs.id, jobId),
		});

		if (!job) return null;

		return this.mapJobToProgress(job);
	}

	/**
	 * Aktif job'ı getir (running veya rate_limited)
	 */
	async getActiveJob(): Promise<FetchJobProgress | null> {
		const job = await db.query.fetchJobs.findFirst({
			where: sqlFn`${fetchJobs.status} IN ('pending', 'running', 'rate_limited')`,
			orderBy: desc(fetchJobs.createdAt),
		});

		if (!job) return null;

		return this.mapJobToProgress(job);
	}

	/**
	 * Job geçmişini getir
	 */
	async getJobHistory(limit: number = 10): Promise<FetchJobProgress[]> {
		const jobs = await db.query.fetchJobs.findMany({
			orderBy: desc(fetchJobs.createdAt),
			limit,
		});

		return jobs.map(job => this.mapJobToProgress(job));
	}

	/**
	 * Retry hazır job'ları bul (scheduler için)
	 */
	async checkRetryJobs(): Promise<number[]> {
		const now = new Date();

		const readyJobs = await db.query.fetchJobs.findMany({
			where: and(
				eq(fetchJobs.status, "rate_limited"),
				lte(fetchJobs.retryAfter, now)
			),
		});

		return readyJobs.map(job => job.id);
	}

	/**
	 * Rate limited job'ı tekrar dene
	 */
	async retryJob(jobId: number): Promise<void> {
		const job = await db.query.fetchJobs.findFirst({
			where: eq(fetchJobs.id, jobId),
		});

		if (!job) {
			throw new Error(`Job bulunamadı: ${jobId}`);
		}

		if (job.status !== "rate_limited") {
			throw new Error(`Job retry yapılabilir durumda değil. Mevcut durum: ${job.status}`);
		}

		// Job'ı running'e çevir ve işle
		await db.update(fetchJobs).set({
			status: "running",
			retryAfter: null,
			rateLimitWaitSeconds: null,
			lastActivityAt: new Date(),
			updatedAt: new Date(),
		}).where(eq(fetchJobs.id, jobId));

		// Job'ı işle (kaldığı yerden devam)
		this.processJob(jobId).catch(err => {
			console.error(`[FetchJob ${jobId}] Retry processing error:`, err);
		});
	}

	/**
	 * Job'ı iptal et
	 */
	async cancelJob(jobId: number): Promise<void> {
		const job = await db.query.fetchJobs.findFirst({
			where: eq(fetchJobs.id, jobId),
		});

		if (!job) {
			throw new Error(`Job bulunamadı: ${jobId}`);
		}

		if (job.status === "completed" || job.status === "cancelled") {
			throw new Error(`Job zaten tamamlanmış veya iptal edilmiş`);
		}

		await db.update(fetchJobs).set({
			status: "cancelled",
			finishedAt: new Date(),
			errorMessage: "Kullanıcı tarafından iptal edildi",
			updatedAt: new Date(),
		}).where(eq(fetchJobs.id, jobId));
	}

	/**
	 * Job'ı işle - Ana çalışma metodu
	 */
	async processJob(jobId: number): Promise<void> {
		// Prevent concurrent processing
		if (this.isProcessing) {
			console.log(`[FetchJob ${jobId}] Skipping - another job is already processing`);
			return;
		}

		this.isProcessing = true;

		try {
			const job = await db.query.fetchJobs.findFirst({
				where: eq(fetchJobs.id, jobId),
			});

			if (!job) {
				throw new Error(`Job bulunamadı: ${jobId}`);
			}

			// Job'ı running'e çevir
			await db.update(fetchJobs).set({
				status: "running",
				startedAt: job.startedAt || new Date(),
				lastActivityAt: new Date(),
				updatedAt: new Date(),
			}).where(eq(fetchJobs.id, jobId));

			const categories = (job.categories || ["tire", "rim", "battery"]) as ProductCategory[];
			let completedCategories = job.completedCategories || 0;
			let productsFetched = job.productsFetched || 0;
			let productsCreated = job.productsCreated || 0;
			let productsUpdated = job.productsUpdated || 0;
			let productsUnchanged = job.productsUnchanged || 0;

			// Kaldığı kategoriden devam et
			for (let i = completedCategories; i < categories.length; i++) {
				const category = categories[i];
				if (!category) continue;

				// Check if job was cancelled
				const currentJob = await db.query.fetchJobs.findFirst({
					where: eq(fetchJobs.id, jobId),
				});
				if (currentJob?.status === "cancelled") {
					console.log(`[FetchJob ${jobId}] Job cancelled, stopping...`);
					return;
				}

				await this.updateJobProgress(jobId, {
					currentCategory: category,
					lastActivityAt: new Date(),
				});

				console.log(`[FetchJob ${jobId}] Fetching category: ${category}`);

				try {
					// Kategorideki tüm ürünleri çek
					const result = await this.fetchCategoryProducts(jobId, category);

					productsFetched += result.fetched;
					productsCreated += result.created;
					productsUpdated += result.updated;
					productsUnchanged += result.unchanged;
					completedCategories++;

					await this.updateJobProgress(jobId, {
						completedCategories,
						productsFetched,
						productsCreated,
						productsUpdated,
						productsUnchanged,
						lastActivityAt: new Date(),
					});

					console.log(`[FetchJob ${jobId}] Category ${category} completed:`, result);
				} catch (error: any) {
					// Rate limit hatası kontrolü
					if (error.message?.includes("RATE_LIMIT:")) {
						const parts = error.message.split(":");
						const waitSeconds = parseInt(parts[1]) || 60;
						const retryAfter = new Date(Date.now() + waitSeconds * 1000);

						const newRetryCount = (job.retryCount || 0) + 1;

						if (newRetryCount > (job.maxRetries || 5)) {
							// Max retry aşıldı - fail
							await db.update(fetchJobs).set({
								status: "failed",
								finishedAt: new Date(),
								errorMessage: `Rate limit: Maksimum deneme sayısı (${job.maxRetries}) aşıldı`,
								updatedAt: new Date(),
							}).where(eq(fetchJobs.id, jobId));

							console.log(`[FetchJob ${jobId}] Failed - max retries exceeded`);
							return;
						}

						// Rate limited durumuna geç
						await db.update(fetchJobs).set({
							status: "rate_limited",
							retryCount: newRetryCount,
							retryAfter: retryAfter,
							rateLimitCategory: category,
							rateLimitWaitSeconds: waitSeconds,
							completedCategories,
							productsFetched,
							productsCreated,
							productsUpdated,
							productsUnchanged,
							lastActivityAt: new Date(),
							updatedAt: new Date(),
						}).where(eq(fetchJobs.id, jobId));

						console.log(`[FetchJob ${jobId}] Rate limited on ${category}. Retry after ${waitSeconds}s (attempt ${newRetryCount}/${job.maxRetries || 5})`);
						return;
					}

					// Diğer hatalar
					throw error;
				}
			}

			// Tüm kategoriler tamamlandı
			await db.update(fetchJobs).set({
				status: "completed",
				finishedAt: new Date(),
				currentCategory: null,
				lastActivityAt: new Date(),
				updatedAt: new Date(),
			}).where(eq(fetchJobs.id, jobId));

			console.log(`[FetchJob ${jobId}] Completed successfully`);
		} catch (error: any) {
			console.error(`[FetchJob ${jobId}] Error:`, error);

			await db.update(fetchJobs).set({
				status: "failed",
				finishedAt: new Date(),
				errorMessage: error.message || "Bilinmeyen hata",
				updatedAt: new Date(),
			}).where(eq(fetchJobs.id, jobId));
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Bir kategorinin tüm ürünlerini çek ve kaydet
	 */
	private async fetchCategoryProducts(
		jobId: number,
		category: ProductCategory
	): Promise<{ fetched: number; created: number; updated: number; unchanged: number }> {
		let page = 1;
		let hasMore = true;
		let fetched = 0;
		let created = 0;
		let updated = 0;
		let unchanged = 0;

		while (hasMore) {
			// Check for rate limit
			const response = await this.fetchWithRateLimitCheck(category, page);

			const products = response.products;
			fetched += products.length;

			// Batch insert/update
			if (products.length > 0) {
				const result = await this.upsertProducts(products, jobId, category);
				created += result.created;
				updated += result.updated;
				unchanged += result.unchanged;
			}

			hasMore = response.hasMore;
			page++;

			// İlerlemeyi güncelle
			await this.updateJobProgress(jobId, {
				productsFetched: (await this.getJobProgress(jobId))?.productsFetched ?? 0 + products.length,
				lastActivityAt: new Date(),
			});
		}

		return { fetched, created, updated, unchanged };
	}

	/**
	 * Rate limit kontrolü ile ürün çek
	 */
	private async fetchWithRateLimitCheck(
		category: ProductCategory,
		page: number
	): Promise<{ products: SupplierProduct[]; hasMore: boolean }> {
		// Gerçek API'de rate limit hatası yakalamak için özel kontrol
		// Mock modunda hata oluşmaz
		try {
			const response = await this.supplierService.getProducts({
				category,
				page,
				limit: BATCH_SIZE,
			});

			return {
				products: response.products,
				hasMore: response.hasMore,
			};
		} catch (error: any) {
			// Rate limit hatası
			if (error.message?.includes("429") || error.message?.includes("Too Many Requests") || error.message?.includes("RATE_LIMIT")) {
				// Retry-After header'dan bekleme süresini çıkar
				const waitSeconds = this.extractWaitSeconds(error.message) || 60;
				throw new Error(`RATE_LIMIT:${waitSeconds}:Tedarikçi API rate limit aşıldı`);
			}
			throw error;
		}
	}

	/**
	 * Ürünleri veritabanına kaydet/güncelle
	 */
	private async upsertProducts(
		products: SupplierProduct[],
		jobId: number,
		category: ProductCategory
	): Promise<{ created: number; updated: number; unchanged: number }> {
		let created = 0;
		let updated = 0;
		let unchanged = 0;

		for (const product of products) {
			const existing = await db.query.supplierProducts.findFirst({
				where: eq(supplierProducts.supplierSku, product.supplierSku),
			});

			if (!existing) {
				// Yeni ürün
				await db.insert(supplierProducts).values({
					supplierSku: product.supplierSku,
					category: category,
					title: product.title,
					brand: product.brand || null,
					model: product.model || null,
					currentPrice: Math.round(product.price * 100), // Kuruşa çevir
					currentStock: product.stock,
					barcode: product.barcode || null,
					description: product.description || null,
					images: product.images || [],
					metafields: product.metafields || {},
					rawApiData: product.metafields || {},
					firstSeenAt: new Date(),
					lastSeenAt: new Date(),
					isActive: true,
				});

				// History kaydı
				await db.insert(supplierProductHistory).values({
					supplierSku: product.supplierSku,
					changeType: "new",
					newPrice: Math.round(product.price * 100),
					newStock: product.stock,
					fetchJobId: jobId,
				});

				created++;
			} else {
				// Mevcut ürün - değişiklik kontrolü
				const newPrice = Math.round(product.price * 100);
				const priceChanged = existing.currentPrice !== newPrice;
				const stockChanged = existing.currentStock !== product.stock;

				if (priceChanged || stockChanged) {
					// Güncelle
					await db.update(supplierProducts).set({
						title: product.title,
						brand: product.brand || null,
						model: product.model || null,
						currentPrice: newPrice,
						currentStock: product.stock,
						barcode: product.barcode || null,
						description: product.description || null,
						images: product.images || [],
						metafields: product.metafields || {},
						rawApiData: product.metafields || {},
						lastSeenAt: new Date(),
						lastPriceChangeAt: priceChanged ? new Date() : existing.lastPriceChangeAt,
						lastStockChangeAt: stockChanged ? new Date() : existing.lastStockChangeAt,
						isActive: true,
						updatedAt: new Date(),
					}).where(eq(supplierProducts.id, existing.id));

					// History kaydı
					let changeType: "price" | "stock" | "both" = "price";
					if (priceChanged && stockChanged) changeType = "both";
					else if (stockChanged) changeType = "stock";

					await db.insert(supplierProductHistory).values({
						supplierSku: product.supplierSku,
						changeType,
						oldPrice: existing.currentPrice,
						oldStock: existing.currentStock,
						newPrice: newPrice,
						newStock: product.stock,
						fetchJobId: jobId,
					});

					updated++;
				} else {
					// Değişiklik yok - sadece lastSeenAt güncelle
					await db.update(supplierProducts).set({
						lastSeenAt: new Date(),
						isActive: true,
					}).where(eq(supplierProducts.id, existing.id));

					unchanged++;
				}
			}
		}

		return { created, updated, unchanged };
	}

	/**
	 * Job ilerlemesini güncelle
	 */
	private async updateJobProgress(jobId: number, updates: Partial<FetchJob>): Promise<void> {
		await db.update(fetchJobs).set({
			...updates,
			updatedAt: new Date(),
		}).where(eq(fetchJobs.id, jobId));
	}

	/**
	 * Hata mesajından bekleme süresini çıkar
	 */
	private extractWaitSeconds(message: string): number | null {
		// "Retry-After: 60" gibi bir pattern ara
		const match = message.match(/(\d+)\s*(?:seconds?|s)/i);
		if (match && match[1]) return parseInt(match[1]);

		// RATE_LIMIT:60:message formatı
		const parts = message.split(":");
		const secondPart = parts[1];
		if (parts.length >= 2 && secondPart && !isNaN(parseInt(secondPart))) {
			return parseInt(secondPart);
		}

		return null;
	}

	/**
	 * FetchJob'ı FetchJobProgress'e dönüştür
	 */
	private mapJobToProgress(job: FetchJob): FetchJobProgress {
		const totalCategories = job.totalCategories || 0;
		const completedCategories = job.completedCategories || 0;
		const progressPercent = totalCategories > 0
			? Math.round((completedCategories / totalCategories) * 100)
			: 0;

		let secondsUntilRetry: number | null = null;
		if (job.status === "rate_limited" && job.retryAfter) {
			const now = Date.now();
			const retryTime = new Date(job.retryAfter).getTime();
			secondsUntilRetry = Math.max(0, Math.ceil((retryTime - now) / 1000));
		}

		return {
			id: job.id,
			status: job.status as FetchJobStatus,
			jobType: job.jobType,
			categories: (job.categories || []) as string[],

			totalCategories,
			completedCategories,
			currentCategory: job.currentCategory,
			productsFetched: job.productsFetched || 0,
			productsCreated: job.productsCreated || 0,
			productsUpdated: job.productsUpdated || 0,
			productsUnchanged: job.productsUnchanged || 0,
			progressPercent,

			retryCount: job.retryCount || 0,
			maxRetries: job.maxRetries || 5,
			retryAfter: job.retryAfter,
			rateLimitCategory: job.rateLimitCategory,
			rateLimitWaitSeconds: job.rateLimitWaitSeconds,
			secondsUntilRetry,

			startedAt: job.startedAt,
			finishedAt: job.finishedAt,
			triggeredBy: job.triggeredBy,
			errorMessage: job.errorMessage,

			createdAt: job.createdAt,
		};
	}
}

// Singleton instance
export const fetchJobService = new FetchJobService();
