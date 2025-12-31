import { pgTable, serial, varchar, timestamp, json, integer, boolean, text, index } from "drizzle-orm/pg-core";

// Kalıcı Ürün Deposu - Tedarikçi ürünlerinin ana tablosu
export const supplierProducts = pgTable("supplier_products", {
	id: serial("id").primaryKey(),
	supplierSku: varchar("supplier_sku", { length: 255 }).notNull().unique(),
	category: varchar("category", { length: 50 }).notNull(), // 'tire' | 'rim' | 'battery'
	title: varchar("title", { length: 500 }).notNull(),
	brand: varchar("brand", { length: 255 }),
	model: varchar("model", { length: 255 }),

	currentPrice: integer("current_price").notNull(), // Kuruş cinsinden
	currentStock: integer("current_stock").notNull().default(0),

	barcode: varchar("barcode", { length: 255 }),
	description: text("description"),
	images: json("images").$type<string[]>().default([]),
	metafields: json("metafields").$type<Record<string, any>>().default({}),
	rawApiData: json("raw_api_data").$type<Record<string, any>>().default({}),

	// Zaman damgaları
	firstSeenAt: timestamp("first_seen_at").defaultNow(),
	lastSeenAt: timestamp("last_seen_at").defaultNow(),
	lastPriceChangeAt: timestamp("last_price_change_at"),
	lastStockChangeAt: timestamp("last_stock_change_at"),

	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),

	// Validasyon Durumu
	validationStatus: varchar("validation_status", { length: 20 }).notNull().default("raw"),
	// Değerler: 'raw' | 'valid' | 'invalid' | 'published' | 'needs_update' | 'inactive'

	// Akıllı SKU (marka-kategori-boyut-id formatında)
	generatedSku: varchar("generated_sku", { length: 100 }),

	// Validasyon Detayları
	missingFields: json("missing_fields").$type<string[]>().default([]),
	validationErrors: json("validation_errors").$type<Array<{field: string, message: string}>>().default([]),

	// Shopify Bağlantısı (hızlı güncelleme için denormalize)
	shopifyProductId: varchar("shopify_product_id", { length: 100 }),
	shopifyVariantId: varchar("shopify_variant_id", { length: 100 }),
	shopifyInventoryItemId: varchar("shopify_inventory_item_id", { length: 100 }),

	// Son Sync Bilgileri (değişiklik tespiti için)
	lastSyncedPrice: integer("last_synced_price"),
	lastSyncedStock: integer("last_synced_stock"),
	lastSyncedAt: timestamp("last_synced_at"),
}, (table) => [
	index("supplier_products_category_idx").on(table.category),
	index("supplier_products_brand_idx").on(table.brand),
	index("supplier_products_active_idx").on(table.isActive),
	index("supplier_products_validation_status_idx").on(table.validationStatus),
	index("supplier_products_shopify_id_idx").on(table.shopifyProductId),
]);

// Fiyat/Stok Değişiklik Geçmişi
export const supplierProductHistory = pgTable("supplier_product_history", {
	id: serial("id").primaryKey(),
	supplierSku: varchar("supplier_sku", { length: 255 }).notNull(),
	changeType: varchar("change_type", { length: 20 }).notNull(), // 'price' | 'stock' | 'both' | 'new' | 'removed'

	oldPrice: integer("old_price"),
	oldStock: integer("old_stock"),
	newPrice: integer("new_price"),
	newStock: integer("new_stock"),

	fetchJobId: integer("fetch_job_id"),
	recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
	index("supplier_product_history_sku_idx").on(table.supplierSku),
	index("supplier_product_history_job_idx").on(table.fetchJobId),
	index("supplier_product_history_recorded_idx").on(table.recordedAt),
]);

// Fetch Job State Machine - Otomatik retry için
export const fetchJobs = pgTable("fetch_jobs", {
	id: serial("id").primaryKey(),
	jobType: varchar("job_type", { length: 50 }).notNull(), // 'full_fetch' | 'category_fetch'
	categories: json("categories").$type<string[]>().default(["tire", "rim", "battery"]),
	status: varchar("status", { length: 20 }).notNull().default("pending"),
	// Status: 'pending' | 'running' | 'completed' | 'failed' | 'rate_limited' | 'cancelled'

	// İlerleme takibi
	totalCategories: integer("total_categories").default(0),
	completedCategories: integer("completed_categories").default(0),
	currentCategory: varchar("current_category", { length: 50 }),
	productsFetched: integer("products_fetched").default(0),
	productsCreated: integer("products_created").default(0),
	productsUpdated: integer("products_updated").default(0),
	productsUnchanged: integer("products_unchanged").default(0),

	// Rate Limit yönetimi
	retryCount: integer("retry_count").default(0),
	maxRetries: integer("max_retries").default(5),
	retryAfter: timestamp("retry_after"), // Ne zaman retry yapılacak
	rateLimitCategory: varchar("rate_limit_category", { length: 50 }),
	rateLimitWaitSeconds: integer("rate_limit_wait_seconds"),

	// Zamanlama
	startedAt: timestamp("started_at"),
	finishedAt: timestamp("finished_at"),
	lastActivityAt: timestamp("last_activity_at").defaultNow(),

	errorMessage: text("error_message"),
	triggeredBy: varchar("triggered_by", { length: 50 }), // 'manual' | 'scheduled' | 'retry'

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
	index("fetch_jobs_status_idx").on(table.status),
	index("fetch_jobs_retry_after_idx").on(table.retryAfter),
]);

// Validasyon Ayarları - Konfigürasyon tablosu
export const validationSettings = pgTable("validation_settings", {
	id: serial("id").primaryKey(),
	key: varchar("key", { length: 100 }).notNull().unique(),
	value: json("value").$type<any>().notNull(),
	description: varchar("description", { length: 500 }),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports
export type SupplierProduct = typeof supplierProducts.$inferSelect;
export type NewSupplierProduct = typeof supplierProducts.$inferInsert;

export type SupplierProductHistory = typeof supplierProductHistory.$inferSelect;
export type NewSupplierProductHistory = typeof supplierProductHistory.$inferInsert;

export type FetchJob = typeof fetchJobs.$inferSelect;
export type NewFetchJob = typeof fetchJobs.$inferInsert;

export type ValidationSetting = typeof validationSettings.$inferSelect;
export type NewValidationSetting = typeof validationSettings.$inferInsert;

export type FetchJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rate_limited' | 'cancelled';
export type ChangeType = 'price' | 'stock' | 'both' | 'new' | 'removed';
export type ProductCategory = 'tire' | 'rim' | 'battery';
export type ValidationStatus = 'raw' | 'valid' | 'invalid' | 'published' | 'needs_update' | 'inactive';

// Validasyon ayarları interface
export interface ValidationSettingsConfig {
	minPrice: number;       // Kuruş cinsinden (50000 = 500 TL)
	minStock: number;       // Minimum stok sayısı
	requireImage: boolean;  // Resim zorunlu mu?
	requireBrand: boolean;  // Marka zorunlu mu?
}
