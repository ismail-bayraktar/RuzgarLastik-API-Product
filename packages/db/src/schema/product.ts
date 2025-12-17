import { pgTable, serial, varchar, timestamp, json, uuid } from "drizzle-orm/pg-core";

export const productMap = pgTable("product_map", {
	id: serial("id").primaryKey(),
	sku: varchar("sku", { length: 255 }).notNull().unique(),
	category: varchar("category", { length: 50 }).notNull(),
	shopifyId: varchar("shopify_id", { length: 255 }),
	inventoryItemId: varchar("inventory_item_id", { length: 255 }),
	dataHash: varchar("data_hash", { length: 255 }),
	lastSyncAt: timestamp("last_sync_at"),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const syncSessions = pgTable("sync_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	startedAt: timestamp("started_at").defaultNow(),
	finishedAt: timestamp("finished_at"),
	status: varchar("status", { length: 20 }).notNull(),
	mode: varchar("mode", { length: 50 }),
	stats: json("stats").default({}),
	errorSummary: varchar("error_summary", { length: 1000 }),
});

export const syncItems = pgTable("sync_items", {
	id: serial("id").primaryKey(),
	sessionId: uuid("session_id").references(() => syncSessions.id),
	sku: varchar("sku", { length: 255 }),
	action: varchar("action", { length: 50 }),
	message: varchar("message", { length: 500 }),
	details: json("details"),
	createdAt: timestamp("created_at").defaultNow(),
});
