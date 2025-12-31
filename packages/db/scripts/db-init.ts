import { db, sqlFn } from "../src/index";
import fs from "fs";
import path from "path";

async function run() {
    const migrationsDir = "./src/migrations";
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();

    console.log("Starting smart database initialization...");

    for (const file of files) {
        console.log(`Processing migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        
        // Split by statement-breakpoint
        const statements = content.split("--> statement-breakpoint");

        for (let statement of statements) {
            statement = statement.trim();
            if (!statement || statement === ";" || statement.startsWith("--")) continue;

            try {
                await db.execute(sqlFn.raw(statement));
                // console.log("  ✅ Statement executed");
            } catch (e: any) {
                if (e.message.includes("already exists") || e.message.includes("already a member")) {
                    // console.log("  ⚠️ Already exists, skipping");
                } else {
                    console.error(`  ❌ Error in statement:`, e.message);
                    console.error(`  Statement: ${statement.substring(0, 100)}...`);
                }
            }
        }
        console.log(`✅ ${file} processed`);
    }

    console.log("Ensuring raw_data column in product_map...");
    try {
        await db.execute(sqlFn.raw(`ALTER TABLE "product_map" ADD COLUMN IF NOT EXISTS "raw_data" json`));
        console.log("✅ raw_data column ensured");
    } catch (e: any) {
        if (e.message.includes("already exists")) {
            console.log("✅ raw_data column already exists");
        } else {
            console.error("❌ Error adding raw_data:", e.message);
        }
    }

    console.log("Ensuring missing columns in supplier_products...");
    const missingColumns = [
        { name: "validation_status", type: "varchar(20) DEFAULT 'raw' NOT NULL" },
        { name: "generated_sku", type: "varchar(100)" },
        { name: "missing_fields", type: "json DEFAULT '[]'::json" },
        { name: "validation_errors", type: "json DEFAULT '[]'::json" },
        { name: "shopify_product_id", type: "varchar(100)" },
        { name: "shopify_variant_id", type: "varchar(100)" },
        { name: "shopify_inventory_item_id", type: "varchar(100)" },
        { name: "last_synced_price", type: "integer" },
        { name: "last_synced_stock", type: "integer" },
        { name: "last_synced_at", type: "timestamp" }
    ];

    for (const col of missingColumns) {
        try {
            await db.execute(sqlFn.raw(`ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`));
            console.log(`  ✅ Column ${col.name} ensured`);
        } catch (e: any) {
             if (!e.message.includes("already exists")) {
                console.error(`  ❌ Error adding ${col.name}:`, e.message);
             }
        }
    }

    console.log("🚀 Database is ready!");
    process.exit(0);
}

run().catch(e => {
    console.error("Fatal Error:", e);
    process.exit(1);
});
