import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(import.meta.dir, "../../.env");
dotenv.config({ path: envPath });

async function main() {
	const { db, sqlFn } = await import("@my-better-t-app/db");

	console.log("Migrating products from products_cache to supplier_products...");

	// Get count of products to migrate
	const countResult = await db.execute(
		"SELECT COUNT(*) as count FROM products_cache"
	);
	const totalCount = parseInt(countResult.rows[0]?.count as string) || 0;
	console.log(`Found ${totalCount} products to migrate`);

	if (totalCount === 0) {
		console.log("No products to migrate");
		return;
	}

	// Migrate in batches
	const BATCH_SIZE = 500;
	let migrated = 0;
	let skipped = 0;

	for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
		const products = await db.execute(sqlFn`
			SELECT
				supplier_sku,
				category,
				title,
				brand,
				model,
				price,
				stock,
				barcode,
				description,
				images,
				metafields,
				created_at,
				updated_at
			FROM products_cache
			ORDER BY id
			LIMIT ${BATCH_SIZE}
			OFFSET ${offset}
		`);

		for (const row of products.rows) {
			try {
				// Check if already exists
				const existing = await db.execute(sqlFn`
					SELECT id FROM supplier_products
					WHERE supplier_sku = ${row.supplier_sku}
				`);

				if (existing.rows.length > 0) {
					skipped++;
					continue;
				}

				// Insert into supplier_products
				await db.execute(sqlFn`
					INSERT INTO supplier_products (
						supplier_sku,
						category,
						title,
						brand,
						model,
						current_price,
						current_stock,
						barcode,
						description,
						images,
						metafields,
						raw_api_data,
						first_seen_at,
						last_seen_at,
						is_active,
						created_at,
						updated_at
					) VALUES (
						${row.supplier_sku},
						${row.category},
						${row.title},
						${row.brand},
						${row.model},
						${row.price},
						${row.stock},
						${row.barcode},
						${row.description},
						${JSON.stringify(row.images || [])},
						${JSON.stringify(row.metafields || {})},
						${JSON.stringify(row.metafields || {})},
						${row.created_at || new Date()},
						${row.updated_at || new Date()},
						true,
						${row.created_at || new Date()},
						${row.updated_at || new Date()}
					)
				`);

				migrated++;
			} catch (error: any) {
				console.error(`Error migrating ${row.supplier_sku}:`, error.message);
				skipped++;
			}
		}

		console.log(`Progress: ${offset + products.rows.length}/${totalCount} (migrated: ${migrated}, skipped: ${skipped})`);
	}

	console.log(`\n✅ Migration completed!`);
	console.log(`   Migrated: ${migrated}`);
	console.log(`   Skipped: ${skipped}`);

	// Verify
	const newCount = await db.execute(
		"SELECT COUNT(*) as count FROM supplier_products"
	);
	console.log(`   supplier_products count: ${newCount.rows[0]?.count}`);
}

main().catch(console.error);
