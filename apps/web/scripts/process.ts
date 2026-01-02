import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { db, eq, and, isNull } from "@my-better-t-app/db";
import { supplierProducts } from "@my-better-t-app/db/schema";
import { TitleParserService } from "../src/services/titleParserService";
import { PricingRulesService } from "../src/services/pricingRulesService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function runProcess() {
  console.log("🚀 Starting Product Processing...");
  
  const titleParser = new TitleParserService();
  const pricingService = new PricingRulesService();
  
  // 1. Fetch raw products
  const rawProducts = await db.select().from(supplierProducts)
    .where(eq(supplierProducts.validationStatus, "raw"));
    
  console.log(`Found ${rawProducts.length} products to process.`);

  let successCount = 0;
  let errorCount = 0;

  const chunkSize = 50;
  for (let i = 0; i < rawProducts.length; i += chunkSize) {
    const chunk = rawProducts.slice(i, i + chunkSize);
    console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(rawProducts.length / chunkSize)} (${chunk.length} products)...`);

    const promises = chunk.map(async (product) => {
      try {
        const category = product.category as "tire" | "rim" | "battery";
        const title = product.title;
        
        // A. Parse Title
        const parseResult = titleParser.parseDetailed(category, title);
        
        // B. Calculate Price
        const pricing = await pricingService.applyPricing(
          (product.currentPrice || 0) / 100,
          category,
          product.brand || undefined
        );

        // C. Generate Smart SKU
        let generatedSku = product.supplierSku;
        if (parseResult.success && parseResult.data) {
          const brandStr = (product.brand || "UNK").toUpperCase().replace(/\s+/g, "");
          if (category === "tire") {
            const d = parseResult.data as any;
            generatedSku = `${brandStr}-${d.width}${d.aspectRatio}${d.rimDiameter}-${product.id}`;
          } else if (category === "rim") {
            const d = parseResult.data as any;
            generatedSku = `${brandStr}-${d.width}X${d.diameter}-${product.id}`;
          }
        }

        // D. Validation Logic
        const errors: Array<{field: string, message: string}> = [];
        const missingFields: string[] = [];

        if (!parseResult.success) {
          errors.push({ field: "title", message: "Ebat bilgileri ayrıştırılamadı." });
          parseResult.fields.filter(f => !f.success).forEach(f => {
            missingFields.push(f.field);
          });
        }

        if (product.currentPrice <= 0) {
          errors.push({ field: "price", message: "Fiyat 0 veya negatif olamaz." });
        }

        const status = errors.length === 0 ? "valid" : "invalid";

        // E. Update Record
        await db.update(supplierProducts)
          .set({
            generatedSku,
            validationStatus: status,
            validationErrors: errors,
            missingFields: missingFields,
            updatedAt: new Date(),
            metafields: {
              ...(product.metafields as object || {}),
              parsed: parseResult.data,
              pricing: pricing
            }
          })
          .where(eq(supplierProducts.id, product.id));

        if (status === "valid") successCount++; else errorCount++;

      } catch (err) {
        console.error(`Failed to process product ${product.supplierSku}:`, err);
        errorCount++;
      }
    });

    await Promise.all(promises);
  }

  console.log(`\n✅ Processing complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  process.exit(0);
}

runProcess();
