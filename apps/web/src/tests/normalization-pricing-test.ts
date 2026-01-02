import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { TitleParserService } from "../services/titleParserService";
import { PricingRulesService } from "../services/pricingRulesService";
import { db } from "@my-better-t-app/db";
import { supplierProducts } from "@my-better-t-app/db/schema";

async function testNormalizationAndPricing() {
  console.log("🚀 Starting Normalization & Pricing Adaptation Test...");
  
  const titleParser = new TitleParserService();
  const pricingService = new PricingRulesService();

  try {
    // 1. Get a product from local DB (Ingested previously)
    const product = await db.query.supplierProducts.findFirst();

    if (!product) {
      console.log("⚠️ No products found in DB. Please run ingestion test first.");
      process.exit(1);
    }

    console.log(`Testing with local product: ${product.supplierSku} - ${product.title}`);

    // 2. Test Normalization (Parsing)
    const enriched = titleParser.enrichMetafields(
      product.category as any,
      product.title,
      product.metafields as any
    );

    console.log("Enriched Metafields (Partial):", {
      width: enriched.width,
      aspectRatio: enriched.aspectRatio,
      rimDiameter: enriched.rimDiameter,
      season: enriched.season
    });

    if (product.category === "tire" && (!enriched.width || !enriched.aspectRatio)) {
      console.warn("⚠️ Tire parsing failed to extract basic dimensions from title.");
    }

    // 3. Test Pricing Rules (Using DB rules)
    const priceResult = await pricingService.applyPricing(
      product.currentPrice / 100, // Convert kurus to TL
      product.category as any,
      product.brand ?? undefined
    );

    console.log("Pricing Result:", {
      supplierPrice: priceResult.supplierPrice,
      finalPrice: priceResult.finalPrice,
      marginPercent: priceResult.marginPercent,
      appliedRuleId: priceResult.appliedRuleId || "Default (20%)"
    });

    if (priceResult.finalPrice <= priceResult.supplierPrice) {
      throw new Error("Final price cannot be less than or equal to supplier price!");
    }

    console.log("✅ Normalization & Pricing Adaptation Test Passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

testNormalizationAndPricing();
