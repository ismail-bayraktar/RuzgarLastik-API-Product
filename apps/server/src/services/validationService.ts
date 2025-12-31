import { db, eq } from "@my-better-t-app/db";
import {
	supplierProducts,
	validationSettings,
	type SupplierProduct,
	type ValidationSettingsConfig,
	type ValidationStatus,
} from "@my-better-t-app/db/schema";

// Marka kodları haritası
const BRAND_CODES: Record<string, string> = {
	// Lastik markaları
	pirelli: "PIR",
	michelin: "MCH",
	goodyear: "GDY",
	bridgestone: "BRD",
	continental: "CNT",
	hankook: "HNK",
	yokohama: "YOK",
	dunlop: "DUN",
	firestone: "FRS",
	bfgoodrich: "BFG",
	kumho: "KMH",
	toyo: "TOY",
	falken: "FLK",
	nexen: "NXN",
	maxxis: "MXS",
	laufenn: "LFN",
	nokian: "NOK",
	petlas: "PTL",
	kormoran: "KRM",
	debica: "DBC",
	sava: "SVA",
	barum: "BRM",
	semperit: "SMP",
	kleber: "KLB",
	uniroyal: "UNR",
	general: "GNR",
	gt_radial: "GTR",
	// Akü markaları
	varta: "VRT",
	bosch: "BSC",
	mutlu: "MTL",
	yuasa: "YSA",
	exide: "EXD",
	banner: "BNR",
	// Jant markaları
	bbs: "BBS",
	oz: "OZR",
	mak: "MAK",
	borbet: "BRB",
	dezent: "DZT",
	rial: "RIL",
	dotz: "DTZ",
	// Varsayılan
	unknown: "UNK",
};

// Kategori kodları
const CATEGORY_CODES: Record<string, string> = {
	tire: "TIR",
	rim: "JNT",
	battery: "AKU",
};

// Validasyon sonucu interface
export interface ValidationResult {
	isValid: boolean;
	missingFields: string[];
	errors: Array<{ field: string; message: string }>;
	generatedSku: string;
}

// Validasyon istatistikleri
export interface ValidationStats {
	total: number;
	raw: number;
	valid: number;
	invalid: number;
	published: number;
	needsUpdate: number;
	inactive: number;
	byReason: Record<string, number>;
}

// Varsayılan validasyon ayarları
const DEFAULT_SETTINGS: ValidationSettingsConfig = {
	minPrice: 50000, // 500 TL (kuruş cinsinden)
	minStock: 2,
	requireImage: true,
	requireBrand: false,
};

export class ValidationService {
	private settingsCache: ValidationSettingsConfig | null = null;
	private settingsCacheTime: number = 0;
	private readonly CACHE_TTL = 60000; // 1 dakika

	/**
	 * Validasyon ayarlarını DB'den al (cache'li)
	 */
	async getSettings(): Promise<ValidationSettingsConfig> {
		// Cache kontrolü
		if (this.settingsCache && Date.now() - this.settingsCacheTime < this.CACHE_TTL) {
			return this.settingsCache;
		}

		const settings = await db.select().from(validationSettings);

		// Ayarları birleştir
		const config: ValidationSettingsConfig = { ...DEFAULT_SETTINGS };

		for (const setting of settings) {
			if (setting.key === "min_price" && typeof setting.value === "number") {
				config.minPrice = setting.value;
			} else if (setting.key === "min_stock" && typeof setting.value === "number") {
				config.minStock = setting.value;
			} else if (setting.key === "require_image" && typeof setting.value === "boolean") {
				config.requireImage = setting.value;
			} else if (setting.key === "require_brand" && typeof setting.value === "boolean") {
				config.requireBrand = setting.value;
			}
		}

		// Cache güncelle
		this.settingsCache = config;
		this.settingsCacheTime = Date.now();

		return config;
	}

	/**
	 * Validasyon ayarlarını güncelle
	 */
	async updateSettings(updates: Partial<ValidationSettingsConfig>): Promise<void> {
		const keyMap: Record<keyof ValidationSettingsConfig, string> = {
			minPrice: "min_price",
			minStock: "min_stock",
			requireImage: "require_image",
			requireBrand: "require_brand",
		};

		const descriptions: Record<string, string> = {
			min_price: "Minimum fiyat (kuruş cinsinden)",
			min_stock: "Minimum stok miktarı",
			require_image: "Resim zorunlu mu?",
			require_brand: "Marka zorunlu mu?",
		};

		for (const [configKey, value] of Object.entries(updates)) {
			const dbKey = keyMap[configKey as keyof ValidationSettingsConfig];
			if (!dbKey) continue;

			// Upsert işlemi
			const existing = await db
				.select()
				.from(validationSettings)
				.where(eq(validationSettings.key, dbKey))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(validationSettings)
					.set({ value, updatedAt: new Date() })
					.where(eq(validationSettings.key, dbKey));
			} else {
				await db.insert(validationSettings).values({
					key: dbKey,
					value,
					description: descriptions[dbKey],
				});
			}
		}

		// Cache'i temizle
		this.settingsCache = null;
	}

	/**
	 * Marka kodunu al (3 harf)
	 */
	getBrandCode(brand: string | null | undefined): string {
		if (!brand) return "UNK";

		const normalized = brand.toLowerCase().replace(/[^a-z0-9]/g, "_");

		// Exact match
		if (BRAND_CODES[normalized]) {
			return BRAND_CODES[normalized];
		}

		// Partial match
		for (const [key, code] of Object.entries(BRAND_CODES)) {
			if (normalized.includes(key) || key.includes(normalized)) {
				return code;
			}
		}

		// İlk 3 karakter (büyük harf)
		return brand.substring(0, 3).toUpperCase() || "UNK";
	}

	/**
	 * Kategori kodunu al
	 */
	getCategoryCode(category: string): string {
		return CATEGORY_CODES[category] || "UNK";
	}

	/**
	 * Boyut kodunu çıkar (lastik, jant, akü için farklı)
	 */
	extractSizeCode(product: SupplierProduct): string {
		const metafields = product.metafields || {};
		const title = product.title || "";

		switch (product.category) {
			case "tire": {
				// Lastik: 205-55R16 veya 245-35R20 formatı
				const width = metafields.lastikGenislik || metafields.width;
				const ratio = metafields.lastikOran || metafields.ratio;
				const diameter = metafields.jantCap || metafields.diameter;

				if (width && ratio && diameter) {
					return `${width}-${ratio}R${diameter}`;
				}

				// Title'dan çıkar
				const tireMatch = title.match(/(\d{3})[\/\s]?(\d{2,3})[RZV]?(\d{2})/i);
				if (tireMatch) {
					return `${tireMatch[1]}-${tireMatch[2]}R${tireMatch[3]}`;
				}

				return "UNK";
			}

			case "rim": {
				// Jant: 7Jx17 veya 8.5x19 formatı
				const width = metafields.jantGenislik || metafields.width;
				const diameter = metafields.jantCap || metafields.diameter;

				if (width && diameter) {
					return `${width}x${diameter}`;
				}

				// Title'dan çıkar
				const rimMatch = title.match(/(\d+(?:\.\d+)?)[Jj]?[xX](\d{2})/);
				if (rimMatch) {
					return `${rimMatch[1]}x${rimMatch[2]}`;
				}

				return "UNK";
			}

			case "battery": {
				// Akü: 60AH formatı
				const capacity = metafields.akuKapasite || metafields.capacity;

				if (capacity) {
					return `${capacity}AH`;
				}

				// Title'dan çıkar
				const batteryMatch = title.match(/(\d{2,3})\s*[Aa][Hh]/);
				if (batteryMatch) {
					return `${batteryMatch[1]}AH`;
				}

				return "UNK";
			}

			default:
				return "UNK";
		}
	}

	/**
	 * Akıllı SKU üret
	 * Format: [MARKA]-[KATEGORI]-[BOYUT]-[ID]
	 * Örnek: PIR-TIR-245-35R20-412887
	 */
	generateSku(product: SupplierProduct): string {
		const brandCode = this.getBrandCode(product.brand);
		const categoryCode = this.getCategoryCode(product.category);
		const sizeCode = this.extractSizeCode(product);

		// Son 6 karakter (supplierSku'dan)
		const uniqueId = product.supplierSku.replace(/[^a-zA-Z0-9]/g, "").slice(-6);

		return `${brandCode}-${categoryCode}-${sizeCode}-${uniqueId}`.toUpperCase();
	}

	/**
	 * Tek ürünü validate et
	 */
	async validateProduct(product: SupplierProduct): Promise<ValidationResult> {
		const settings = await this.getSettings();
		const errors: Array<{ field: string; message: string }> = [];
		const missingFields: string[] = [];

		// 1. Fiyat kontrolü
		if (!product.currentPrice || product.currentPrice <= 0) {
			errors.push({
				field: "price",
				message: "Fiyat bilgisi yok",
			});
			missingFields.push("price");
		} else if (product.currentPrice < settings.minPrice) {
			errors.push({
				field: "price",
				message: `Fiyat ${settings.minPrice / 100} TL altında (${(product.currentPrice / 100).toFixed(2)} TL)`,
			});
		}

		// 2. Stok kontrolü
		if (product.currentStock === null || product.currentStock === undefined) {
			errors.push({
				field: "stock",
				message: "Stok bilgisi yok",
			});
			missingFields.push("stock");
		} else if (product.currentStock < settings.minStock) {
			errors.push({
				field: "stock",
				message: `Stok ${settings.minStock} altında (${product.currentStock})`,
			});
		}

		// 3. Resim kontrolü
		if (settings.requireImage) {
			const images = product.images || [];
			const hasValidImage = images.some(
				(img) => img && img.trim() !== "" && !img.toLowerCase().includes("placeholder")
			);

			if (!hasValidImage) {
				errors.push({
					field: "image",
					message: "Geçerli resim yok",
				});
				missingFields.push("image");
			}
		}

		// 4. Marka kontrolü (opsiyonel)
		if (settings.requireBrand && !product.brand) {
			errors.push({
				field: "brand",
				message: "Marka bilgisi yok",
			});
			missingFields.push("brand");
		}

		return {
			isValid: errors.length === 0,
			missingFields,
			errors,
			generatedSku: this.generateSku(product),
		};
	}

	/**
	 * Tüm ürünleri validate et ve DB'yi güncelle
	 */
	async validateAll(category?: string): Promise<ValidationStats> {
		// Ürünleri al
		let query = db.select().from(supplierProducts);

		if (category) {
			query = query.where(eq(supplierProducts.category, category)) as typeof query;
		}

		const products = await query;

		const stats: ValidationStats = {
			total: products.length,
			raw: 0,
			valid: 0,
			invalid: 0,
			published: 0,
			needsUpdate: 0,
			inactive: 0,
			byReason: {},
		};

		// Her ürünü validate et
		for (const product of products) {
			const result = await this.validateProduct(product);

			// Mevcut duruma göre yeni durumu belirle
			let newStatus: ValidationStatus;

			if (result.isValid) {
				// Shopify'da var mı kontrol et
				if (product.shopifyProductId) {
					// Fiyat/stok değişmiş mi?
					const priceChanged = product.currentPrice !== product.lastSyncedPrice;
					const stockChanged = product.currentStock !== product.lastSyncedStock;

					if (priceChanged || stockChanged) {
						newStatus = "needs_update";
						stats.needsUpdate++;
					} else {
						newStatus = "published";
						stats.published++;
					}
				} else {
					newStatus = "valid";
					stats.valid++;
				}
			} else {
				// Geçersiz
				if (product.shopifyProductId) {
					// Daha önce yayındaydı, şimdi geçersiz
					newStatus = "inactive";
					stats.inactive++;
				} else {
					newStatus = "invalid";
					stats.invalid++;
				}

				// Hata nedenlerini say
				for (const error of result.errors) {
					stats.byReason[error.field] = (stats.byReason[error.field] || 0) + 1;
				}
			}

			// DB'yi güncelle
			await db
				.update(supplierProducts)
				.set({
					validationStatus: newStatus,
					generatedSku: result.generatedSku,
					missingFields: result.missingFields,
					validationErrors: result.errors,
					updatedAt: new Date(),
				})
				.where(eq(supplierProducts.id, product.id));
		}

		return stats;
	}

	/**
	 * Validasyon istatistiklerini al (DB'den)
	 */
	async getValidationStats(): Promise<ValidationStats> {
		const products = await db
			.select({
				validationStatus: supplierProducts.validationStatus,
				validationErrors: supplierProducts.validationErrors,
			})
			.from(supplierProducts);

		const stats: ValidationStats = {
			total: products.length,
			raw: 0,
			valid: 0,
			invalid: 0,
			published: 0,
			needsUpdate: 0,
			inactive: 0,
			byReason: {},
		};

		for (const product of products) {
			switch (product.validationStatus) {
				case "raw":
					stats.raw++;
					break;
				case "valid":
					stats.valid++;
					break;
				case "invalid":
					stats.invalid++;
					break;
				case "published":
					stats.published++;
					break;
				case "needs_update":
					stats.needsUpdate++;
					break;
				case "inactive":
					stats.inactive++;
					break;
			}

			// Hata nedenlerini say
			const errors = product.validationErrors as Array<{ field: string; message: string }> || [];
			for (const error of errors) {
				stats.byReason[error.field] = (stats.byReason[error.field] || 0) + 1;
			}
		}

		return stats;
	}

	/**
	 * Manuel onay (valid yap)
	 */
	async approveProduct(productId: number): Promise<void> {
		const product = await db
			.select()
			.from(supplierProducts)
			.where(eq(supplierProducts.id, productId))
			.limit(1);

		if (!product.length) {
			throw new Error("Ürün bulunamadı");
		}

		await db
			.update(supplierProducts)
			.set({
				validationStatus: "valid",
				validationErrors: [],
				missingFields: [],
				updatedAt: new Date(),
			})
			.where(eq(supplierProducts.id, productId));
	}

	/**
	 * Manuel red (invalid yap)
	 */
	async rejectProduct(productId: number, reason?: string): Promise<void> {
		await db
			.update(supplierProducts)
			.set({
				validationStatus: "invalid",
				validationErrors: reason
					? [{ field: "manual", message: reason }]
					: [{ field: "manual", message: "Manuel olarak reddedildi" }],
				updatedAt: new Date(),
			})
			.where(eq(supplierProducts.id, productId));
	}
}

// Singleton instance
export const validationService = new ValidationService();
