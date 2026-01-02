import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(import.meta.dir, "../../.env");
dotenv.config({ path: envPath });

async function main() {
	const { db } = await import("@my-better-t-app/db");

	console.log("Adding validation columns to supplier_products table...\n");

	// 1. Add validation columns to supplier_products
	const alterQueries = [
		// Validation status
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) NOT NULL DEFAULT 'raw'`,
		// Generated SKU
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS generated_sku VARCHAR(100)`,
		// Missing fields
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS missing_fields JSONB DEFAULT '[]'::jsonb`,
		// Validation errors
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb`,
		// Shopify IDs
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS shopify_product_id VARCHAR(100)`,
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS shopify_variant_id VARCHAR(100)`,
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS shopify_inventory_item_id VARCHAR(100)`,
		// Last synced info
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS last_synced_price INTEGER`,
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS last_synced_stock INTEGER`,
		`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP`,
	];

	for (const query of alterQueries) {
		try {
			await db.execute(query);
			console.log(`✅ ${query.split("ADD COLUMN IF NOT EXISTS")[1]?.split(" ")[1] || "Query"} added`);
		} catch (error: any) {
			if (error.message.includes("already exists")) {
				console.log(`⏭️  Column already exists, skipping`);
			} else {
				console.error(`❌ Error: ${error.message}`);
			}
		}
	}

	// 2. Create indexes
	const indexQueries = [
		`CREATE INDEX IF NOT EXISTS supplier_products_validation_status_idx ON supplier_products(validation_status)`,
		`CREATE INDEX IF NOT EXISTS supplier_products_shopify_id_idx ON supplier_products(shopify_product_id)`,
	];

	console.log("\nCreating indexes...");
	for (const query of indexQueries) {
		try {
			await db.execute(query);
			console.log(`✅ Index created`);
		} catch (error: any) {
			if (error.message.includes("already exists")) {
				console.log(`⏭️  Index already exists`);
			} else {
				console.error(`❌ Error: ${error.message}`);
			}
		}
	}

	// 3. Create validation_settings table
	console.log("\nCreating validation_settings table...");
	try {
		await db.execute(`
			CREATE TABLE IF NOT EXISTS validation_settings (
				id SERIAL PRIMARY KEY,
				key VARCHAR(100) NOT NULL UNIQUE,
				value JSONB NOT NULL,
				description VARCHAR(500),
				updated_at TIMESTAMP DEFAULT NOW()
			)
		`);
		console.log(`✅ validation_settings table created`);
	} catch (error: any) {
		if (error.message.includes("already exists")) {
			console.log(`⏭️  Table already exists`);
		} else {
			console.error(`❌ Error: ${error.message}`);
		}
	}

	// 4. Insert default validation settings
	console.log("\nInserting default validation settings...");
	const defaultSettings = [
		{ key: "min_price", value: 50000, description: "Minimum fiyat (kuruş cinsinden, 50000 = 500 TL)" },
		{ key: "min_stock", value: 2, description: "Minimum stok miktarı" },
		{ key: "require_image", value: true, description: "Resim zorunlu mu?" },
		{ key: "require_brand", value: false, description: "Marka zorunlu mu?" },
	];

	for (const setting of defaultSettings) {
		try {
			await db.execute(`
				INSERT INTO validation_settings (key, value, description)
				VALUES ('${setting.key}', '${JSON.stringify(setting.value)}'::jsonb, '${setting.description}')
				ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
			`);
			console.log(`✅ ${setting.key} = ${setting.value}`);
		} catch (error: any) {
			console.error(`❌ Error inserting ${setting.key}: ${error.message}`);
		}
	}

	// 5. Verify
	console.log("\n📊 Verification:");
	const columns = await db.execute(`
		SELECT column_name, data_type
		FROM information_schema.columns
		WHERE table_name = 'supplier_products'
		AND column_name IN ('validation_status', 'generated_sku', 'missing_fields', 'validation_errors', 'shopify_product_id', 'shopify_variant_id', 'shopify_inventory_item_id', 'last_synced_price', 'last_synced_stock', 'last_synced_at')
		ORDER BY column_name
	`);
	console.log(`Found ${columns.rows.length} validation columns:`);
	for (const col of columns.rows) {
		console.log(`  - ${col.column_name}: ${col.data_type}`);
	}

	const settingsCount = await db.execute(`SELECT COUNT(*) as count FROM validation_settings`);
	console.log(`\nValidation settings: ${settingsCount.rows[0]?.count || 0} entries`);

	console.log("\n✅ Migration completed!");
}

main().catch(console.error);
