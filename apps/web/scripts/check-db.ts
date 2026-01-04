import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../../.env"); // Point to root .env
dotenv.config({ path: envPath });

async function main() {
	const { db } = await import("@my-better-t-app/db");

	const products = await db.execute(
		"SELECT COUNT(*) as count FROM supplier_products"
	);
	console.log("supplier_products:", products.rows[0]);

	const jobs = await db.execute(
		"SELECT id, status, products_fetched, products_created, products_updated FROM fetch_jobs ORDER BY id DESC LIMIT 3"
	);
	console.log("fetch_jobs:", jobs.rows);

	const cache = await db.execute(
		"SELECT COUNT(*) as count FROM products_cache"
	);
	console.log("products_cache:", cache.rows[0]);

	const statusDistribution = await db.execute(
		"SELECT validation_status, COUNT(*) as count FROM supplier_products GROUP BY validation_status"
	);
	console.log("Validation Status Distribution:", statusDistribution.rows);
}

main();
