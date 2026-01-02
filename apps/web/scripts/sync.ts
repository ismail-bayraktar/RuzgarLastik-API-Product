import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { db, eq, and, or, isNotNull, ne } from "@my-better-t-app/db";
import { supplierProducts } from "@my-better-t-app/db/schema";
import { ShopifyService } from "../src/services/shopifyService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function runSync() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`🚀 Starting Shopify Synchronization (Dry Run: ${dryRun})...
`);
  
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

  // 1. Fetch products that NEED sync
  // (valid or needs_update) OR (published AND (price or stock changed))
  const allProducts = await db.select().from(supplierProducts)
    .where(or(
      eq(supplierProducts.validationStatus, "valid"),
      eq(supplierProducts.validationStatus, "needs_update"),
      and(
        eq(supplierProducts.validationStatus, "published"),
        or(
          ne(supplierProducts.currentPrice, supplierProducts.lastSyncedPrice ?? -1),
          ne(supplierProducts.currentStock, supplierProducts.lastSyncedStock ?? -1)
        )
      )
    ));

  console.log(`Found ${allProducts.length} products to sync.`);

  let successCount = 0;
  let errorCount = 0;

  const chunkSize = 10;
  for (let i = 0; i < allProducts.length; i += chunkSize) {
    const chunk = allProducts.slice(i, i + chunkSize);
    console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(allProducts.length / chunkSize)} (${chunk.length} products)...`);

    const promises = chunk.map(async (product) => {
      try {
        // console.log(`Syncing ${product.supplierSku}: ${product.title}`); // Reduce noise
        
        const price = (product.currentPrice || 0) / 100;
        const stock = product.currentStock || 0;

        if (dryRun) {
          // console.log(`  [DRY RUN] Would sync Price: ${price}, Stock: ${stock}`);
          successCount++;
          return;
        }

        let shopifyProductId = product.shopifyProductId;
        let shopifyVariantId = product.shopifyVariantId;
        let shopifyInventoryItemId = product.shopifyInventoryItemId;

        if (shopifyProductId) {
          // UPDATE
          // console.log(`  Updating existing product ${shopifyProductId}...`);
          
          // Update price via variant
          if (shopifyVariantId) {
            await shopifyService.updateVariant({
              id: shopifyVariantId,
              price: price.toString()
            });
          }

          // Update inventory
          if (shopifyInventoryItemId) {
            await shopifyService.updateInventory({
              inventoryItemId: shopifyInventoryItemId,
              locationId,
              availableQuantity: stock
            });
          }
        } else {
          // CREATE
          // console.log(`  Creating new product in Shopify...`);
          const created = await shopifyService.createProduct({
            title: product.title,
            vendor: product.brand || "",
            productType: product.category,
            status: "ACTIVE",
            variants: [{ 
              sku: product.generatedSku || product.supplierSku,
              price: price.toString()
            }],
            images: product.images?.map((src: string) => ({ src })) || []
          });

          shopifyProductId = created.id;
          const variant = created.variants?.[0];
          shopifyVariantId = variant?.id || null;
          shopifyInventoryItemId = variant?.inventoryItem?.id || null;

          // Finalize inventory for new product
          if (shopifyInventoryItemId) {
            await shopifyService.updateInventory({
              inventoryItemId: shopifyInventoryItemId,
              locationId,
              availableQuantity: stock
            });
          }
        }

        // Update DB
        await db.update(supplierProducts)
          .set({
            shopifyProductId,
            shopifyVariantId,
            shopifyInventoryItemId,
            lastSyncedPrice: product.currentPrice,
            lastSyncedStock: product.currentStock,
            lastSyncedAt: new Date(),
            validationStatus: "published",
            updatedAt: new Date()
          })
          .where(eq(supplierProducts.id, product.id));

        successCount++;
        // console.log(`  ✅ Successfully synced ${product.supplierSku}`);

      } catch (err) {
        console.error(`  ❌ Failed to sync ${product.supplierSku}:`, err);
        errorCount++;
      }
    });

    await Promise.all(promises);
  }

  console.log(`\n✅ Synchronization complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  process.exit(0);
}

runSync();