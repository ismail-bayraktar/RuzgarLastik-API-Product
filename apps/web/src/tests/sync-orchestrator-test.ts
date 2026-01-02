import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { SyncOrchestrator } from "../services/syncOrchestrator";
import { SupplierService } from "../services/supplierService";
import { ShopifyService } from "../services/shopifyService";

async function testSyncOrchestrator() {
  console.log("🚀 Starting SyncOrchestrator Decoupled Flow Test...");
  
  // 1. Setup Mock Services
  const supplierService = new SupplierService({ useMock: true });
  
  // Shopify service requires config
  const shopifyService = new ShopifyService({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || "test.myshopify.com",
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || "test-token",
    locationId: process.env.SHOPIFY_LOCATION_ID || "gid://shopify/Location/123",
    debug: true
  }); 

  const orchestrator = new SyncOrchestrator({
    supplierService,
    shopifyService
  });

  try {
    // 2. Run Sync in Dry Run mode
    console.log("Running Sync (Dry Run)...");
    const result = await orchestrator.startSync({
      mode: "full",
      categories: ["tire"],
      dryRun: true,
      validateFirst: true
    });

    console.log("Sync Result Summary:");
    console.log(`- Status: ${result.status}`);
    console.log(`- Total Products: ${result.totalProducts}`);
    console.log(`- Validated: ${result.validated}`);
    console.log(`- Valid Count: ${result.validCount}`);
    console.log(`- Invalid Count: ${result.invalidCount}`);
    console.log(`- Created (Dry Run): ${result.created}`);
    console.log(`- Updated (Dry Run): ${result.updated}`);
    console.log(`- Skipped: ${result.skipped}`);

    if (result.totalProducts === 0) {
      throw new Error("No products were processed!");
    }

    if (result.status !== "completed") {
      throw new Error(`Sync status is ${result.status}, expected 'completed'`);
    }

    console.log("✅ SyncOrchestrator Decoupled Flow Test Passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ SyncOrchestrator Test Failed:", error);
    process.exit(1);
  }
}

testSyncOrchestrator();