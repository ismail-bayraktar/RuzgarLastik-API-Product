import { pgTable, serial, varchar, timestamp, json, integer, boolean, text } from "drizzle-orm/pg-core";

export const productsCache = pgTable("products_cache", {
	id: serial("id").primaryKey(),
	supplierSku: varchar("supplier_sku", { length: 255 }).notNull().unique(),
	category: varchar("category", { length: 50 }).notNull(),
	title: varchar("title", { length: 500 }).notNull(),
	brand: varchar("brand", { length: 255 }),
	model: varchar("model", { length: 255 }),
	price: integer("price").notNull(),
	stock: integer("stock").notNull().default(0),
	barcode: varchar("barcode", { length: 255 }),
	description: text("description"),
	images: json("images").$type<string[]>().default([]),
	metafields: json("metafields").$type<Record<string, any>>().default({}),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const cacheMetadata = pgTable("cache_metadata", {
	id: serial("id").primaryKey(),
	category: varchar("category", { length: 50 }).notNull().unique(),
	lastFetchAt: timestamp("last_fetch_at"),
	productCount: integer("product_count").default(0),
	fetchDurationMs: integer("fetch_duration_ms"),
	status: varchar("status", { length: 20 }).default("idle"),
	errorMessage: varchar("error_message", { length: 500 }),
	autoRefreshEnabled: boolean("auto_refresh_enabled").default(true),
	refreshIntervalHours: integer("refresh_interval_hours").default(24),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
