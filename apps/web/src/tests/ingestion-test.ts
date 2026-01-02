import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env from apps/server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { SupplierService } from "../services/supplierService";
import { db } from "@my-better-t-app/db";
import { supplierProducts } from "@my-better-t-app/db/schema";

async function testIngestion() {
  console.log("🚀 Starting Ingestion Integration Test...");
  
  // Use mock for testing
  const supplierService = new SupplierService({ useMock: true });
  
  try {
    // 1. Run ingestion
    const stats = await supplierService.fetchAndIngest("tire");
    console.log("Stats:", stats);

    if (stats.totalFetched === 0) {
      throw new Error("No products were fetched!");
    }

    // 2. Check DB
    const products = await db.select().from(supplierProducts).limit(5);
    console.log(`Found ${products.length} products in DB.`);

    if (products.length === 0) {
      throw new Error("Database is empty after ingestion!");
    }

    // 3. Check raw data
    const firstProduct = products[0];
    console.log(`Sample Product: ${firstProduct.supplierSku} - ${firstProduct.title}`);
    
    // In our implementation, rawApiData should be populated
    if (!firstProduct.rawApiData || Object.keys(firstProduct.rawApiData as object).length === 0) {
      console.log("Raw Data:", firstProduct.rawApiData);
      throw new Error("rawApiData is missing or empty!");
    }

    console.log("✅ Ingestion Test Passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ingestion Test Failed:", error);
    process.exit(1);
  }
}

testIngestion();
