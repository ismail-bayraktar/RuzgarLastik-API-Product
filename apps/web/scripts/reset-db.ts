import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function resetDb() {
  console.log("🚀 Resetting Database...");
  
  const { db } = await import("@my-better-t-app/db");
  const { supplierProducts, productsCache, fetchJobs, syncSessions, syncItems, supplierProductHistory } = await import("@my-better-t-app/db/schema");
  
  try {
    console.log("  - Truncating supplier_products...");
    await db.delete(supplierProducts);
    
    console.log("  - Truncating products_cache...");
    await db.delete(productsCache);
    
    console.log("  - Truncating fetch_jobs...");
    await db.delete(fetchJobs);
    
    console.log("  - Truncating sync_sessions...");
    await db.delete(syncSessions);
    
    console.log("  - Truncating sync_items...");
    await db.delete(syncItems);

    console.log("  - Truncating supplier_product_history...");
    await db.delete(supplierProductHistory);
    
    console.log("✅ Database reset successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database reset failed:", error);
    process.exit(1);
  }
}

resetDb();
