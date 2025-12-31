CREATE TABLE "cache_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"last_fetch_at" timestamp,
	"product_count" integer DEFAULT 0,
	"fetch_duration_ms" integer,
	"status" varchar(20) DEFAULT 'idle',
	"error_message" varchar(500),
	"auto_refresh_enabled" boolean DEFAULT true,
	"refresh_interval_hours" integer DEFAULT 6,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cache_metadata_category_unique" UNIQUE("category")
);
--> statement-breakpoint
CREATE TABLE "products_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_sku" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"brand" varchar(255),
	"model" varchar(255),
	"price" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"barcode" varchar(255),
	"description" text,
	"images" json DEFAULT '[]'::json,
	"metafields" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_cache_supplier_sku_unique" UNIQUE("supplier_sku")
);
--> statement-breakpoint
CREATE TABLE "api_test_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"url" varchar(500) NOT NULL,
	"success" boolean NOT NULL,
	"status_code" integer,
	"response_time_ms" integer,
	"product_count" integer,
	"error_message" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fetch_jobs" (
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
);
--> statement-breakpoint
CREATE TABLE "supplier_product_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_sku" varchar(255) NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"old_price" integer,
	"old_stock" integer,
	"new_price" integer,
	"new_stock" integer,
	"fetch_job_id" integer,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
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
);
--> statement-breakpoint
CREATE INDEX "fetch_jobs_status_idx" ON "fetch_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fetch_jobs_retry_after_idx" ON "fetch_jobs" USING btree ("retry_after");--> statement-breakpoint
CREATE INDEX "supplier_product_history_sku_idx" ON "supplier_product_history" USING btree ("supplier_sku");--> statement-breakpoint
CREATE INDEX "supplier_product_history_job_idx" ON "supplier_product_history" USING btree ("fetch_job_id");--> statement-breakpoint
CREATE INDEX "supplier_product_history_recorded_idx" ON "supplier_product_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "supplier_products_category_idx" ON "supplier_products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "supplier_products_brand_idx" ON "supplier_products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "supplier_products_active_idx" ON "supplier_products" USING btree ("is_active");