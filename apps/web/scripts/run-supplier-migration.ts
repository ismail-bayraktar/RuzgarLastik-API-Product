import dotenv from "dotenv";
import path from "path";

// Load env - MUST be before db import
const envPath = path.resolve(import.meta.dir, "../../.env");
console.log("Loading env from:", envPath);
dotenv.config({ path: envPath });

// Dynamic import AFTER env is loaded
async function main() {
	console.log("DATABASE_URL set:", process.env.DATABASE_URL ? "Yes" : "No");

	// Dynamic import to ensure env is loaded first
	const { db, sqlFn } = await import("@my-better-t-app/db");

	console.log("Running supplier tables migration...");

	try {
		// Create fetch_jobs table
		await db.execute(sqlFn`
			CREATE TABLE IF NOT EXISTS "fetch_jobs" (
				"id" serial PRIMARY KEY NOT NULL,
				"job_type" varchar(50) NOT NULL,
				"categories" json DEFAULT '["tire","rim","battery"]'::json,
				"status" varchar(20) DEFAULT 'pending' NOT NULL,
				"total_categories" integer DEFAULT 0,
				"completed_categories" integer DEFAULT 0,
				"current_category" varchar(50),
				"products_fetched" integer DEFAULT 0,
				"products_created" integer DEFAULT 0,
				"products_updated" integer DEFAULT 0,
				"products_unchanged" integer DEFAULT 0,
				"retry_count" integer DEFAULT 0,
				"max_retries" integer DEFAULT 5,
				"retry_after" timestamp,
				"rate_limit_category" varchar(50),
				"rate_limit_wait_seconds" integer,
				"started_at" timestamp,
				"finished_at" timestamp,
				"last_activity_at" timestamp DEFAULT now(),
				"error_message" text,
				"triggered_by" varchar(50),
				"created_at" timestamp DEFAULT now(),
				"updated_at" timestamp DEFAULT now()
			)
		`);
		console.log("✓ fetch_jobs table created");

		// Create supplier_product_history table
		await db.execute(sqlFn`
			CREATE TABLE IF NOT EXISTS "supplier_product_history" (
				"id" serial PRIMARY KEY NOT NULL,
				"supplier_sku" varchar(255) NOT NULL,
				"change_type" varchar(20) NOT NULL,
				"old_price" integer,
				"old_stock" integer,
				"new_price" integer,
				"new_stock" integer,
				"fetch_job_id" integer,
				"recorded_at" timestamp DEFAULT now()
			)
		`);
		console.log("✓ supplier_product_history table created");

		// Create supplier_products table
		await db.execute(sqlFn`
			CREATE TABLE IF NOT EXISTS "supplier_products" (
				"id" serial PRIMARY KEY NOT NULL,
				"supplier_sku" varchar(255) NOT NULL,
				"category" varchar(50) NOT NULL,
				"title" varchar(500) NOT NULL,
				"brand" varchar(255),
				"model" varchar(255),
				"current_price" integer NOT NULL,
				"current_stock" integer DEFAULT 0 NOT NULL,
				"barcode" varchar(255),
				"description" text,
				"images" json DEFAULT '[]'::json,
				"metafields" json DEFAULT '{}'::json,
				"raw_api_data" json DEFAULT '{}'::json,
				"first_seen_at" timestamp DEFAULT now(),
				"last_seen_at" timestamp DEFAULT now(),
				"last_price_change_at" timestamp,
				"last_stock_change_at" timestamp,
				"is_active" boolean DEFAULT true,
				"created_at" timestamp DEFAULT now(),
				"updated_at" timestamp DEFAULT now(),
				CONSTRAINT "supplier_products_supplier_sku_unique" UNIQUE("supplier_sku")
			)
		`);
		console.log("✓ supplier_products table created");

		// Create indexes
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "fetch_jobs_status_idx" ON "fetch_jobs" USING btree ("status")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "fetch_jobs_retry_after_idx" ON "fetch_jobs" USING btree ("retry_after")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "supplier_product_history_sku_idx" ON "supplier_product_history" USING btree ("supplier_sku")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "supplier_product_history_job_idx" ON "supplier_product_history" USING btree ("fetch_job_id")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "supplier_product_history_recorded_idx" ON "supplier_product_history" USING btree ("recorded_at")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "supplier_products_category_idx" ON "supplier_products" USING btree ("category")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "supplier_products_brand_idx" ON "supplier_products" USING btree ("brand")`);
		await db.execute(sqlFn`CREATE INDEX IF NOT EXISTS "supplier_products_active_idx" ON "supplier_products" USING btree ("is_active")`);
		console.log("✓ indexes created");

		console.log("\n✅ Migration completed successfully!");
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	}
}

main();
