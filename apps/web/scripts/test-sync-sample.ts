import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { db, eq, and } from "@my-better-t-app/db";
import { supplierProducts } from "@my-better-t-app/db/schema";
import { ShopifyService } from "../src/services/shopifyService";
import { prepareMetafieldsForShopify } from "../src/services/metafieldUtils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function runTestSync() {
  console.log("🚀 Starting Targeted Sync Test (5 Products)...");

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const locationId = process.env.SHOPIFY_LOCATION_ID;

  if (!shopDomain || !accessToken || !locationId) {
    console.error("❌ Shopify credentials missing in .env");
    process.exit(1);
  }

  const shopifyService = new ShopifyService({
    shopDomain,
    accessToken,
    locationId,
    debug: true
  });

  // 1. Select sample products (mix of categories)
  console.log("🔍 Selecting sample products...");
  
  const tires = await db.select().from(supplierProducts)
    .where(and(eq(supplierProducts.category, 'tire'), eq(supplierProducts.validationStatus, 'valid')))
    .limit(2);
    
  const rims = await db.select().from(supplierProducts)
    .where(and(eq(supplierProducts.category, 'rim'), eq(supplierProducts.validationStatus, 'valid')))
    .limit(2);
    
  const batteries = await db.select().from(supplierProducts)
    .where(and(eq(supplierProducts.category, 'battery'), eq(supplierProducts.validationStatus, 'valid')))
    .limit(1);

  const products = [...tires, ...rims, ...batteries];

  if (products.length === 0) {
    console.error("❌ No valid products found in database. Run ingest/process first.");
    process.exit(1);
  }

  console.log(`Found ${products.length} products to test.`);

  for (const product of products) {
    try {
      console.log(`
----------------------------------------`);
      console.log(`📦 Processing: ${product.supplierSku} (${product.category})`);
      console.log(`   Title: ${product.title}`);
      
      const price = (product.currentPrice || 0) / 100;
      const stock = product.currentStock || 0;
      
      // Prepare Metafields
      // Merge raw data with parsed data to ensure we have everything
      const rawMeta = product.metafields as Record<string, any> || {};
      const parsedMeta = rawMeta.parsed || {};
      
      const combinedMeta = {
        ...parsedMeta,
        marka: product.brand,
        urun_tipi: product.category === 'tire' ? 'Lastik' : product.category === 'rim' ? 'Jant' : 'Akü',
        tedarikci_adi: 'Ruzgar Lastik' // Or generic supplier name
      };

      console.log("   Preparing Metafields...");
      const shopifyMetafields = prepareMetafieldsForShopify(combinedMeta, "custom");
      
      if (shopifyMetafields.length > 0) {
        console.log(`   ✅ Prepared ${shopifyMetafields.length} metafields:`, shopifyMetafields.map(m => m.key).join(", "));
      } else {
        console.log(`   ⚠️ No valid metafields generated.`);
      }

      // Check if product exists (for idempotent test)
      let shopifyProductId = product.shopifyProductId;
      
      if (shopifyProductId) {
        console.log(`   🔄 Updating existing product (ID: ${shopifyProductId})...`);
        // In this test, we force update logic if implemented, or just skip
        // For now, let's focus on CREATION logic as that's the main goal. 
        // If it exists, we might want to skip or try to create a duplicate for testing if SKU allows (usually not).
        console.log("   ⚠️ Product already linked. Skipping creation to avoid duplicates/errors in this test.");
        continue; 
      }

      console.log(`   🚀 Sending to Shopify...`);
      
      const created = await shopifyService.createProduct({
        title: product.title,
        vendor: product.brand || "Generic",
        productType: product.category,
        status: "ACTIVE",
        variants: [{ 
          sku: product.generatedSku || product.supplierSku,
          price: price.toString()
        }],
        images: product.images?.map((src: string) => ({ src })) || [],
        metafields: shopifyMetafields
      });

      console.log(`   ✅ SUCCESS! Created Shopify Product ID: ${created.id}`);
      
      // Update DB
      await db.update(supplierProducts)
        .set({
          shopifyProductId: created.id,
          shopifyVariantId: created.variants?.edges?.[0]?.node?.id,
          shopifyInventoryItemId: created.variants?.edges?.[0]?.node?.inventoryItem?.id,
          lastSyncedPrice: product.currentPrice,
          lastSyncedStock: product.currentStock,
          lastSyncedAt: new Date(),
          validationStatus: "published",
          updatedAt: new Date()
        })
        .where(eq(supplierProducts.id, product.id));

      // Finalize inventory
      const inventoryItemId = created.variants?.edges?.[0]?.node?.inventoryItem?.id;
      if (inventoryItemId) {
        console.log(`   📦 Updating inventory to ${stock}...`);
        await shopifyService.updateInventory({
          inventoryItemId,
          locationId,
          availableQuantity: stock
        });
      }

    } catch (err: any) {
      console.error(`   ❌ FAIL: ${err.message}`);
      if (err.response) {
        console.error(JSON.stringify(err.response, null, 2));
      }
    }
  }

  console.log("\n✅ Test Complete!");
  process.exit(0);
}

runTestSync();
