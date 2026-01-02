#!/usr/bin/env bun
/**
 * CLI script for running validation and smart sync
 * Used by GitHub Actions cron job for automatic 04:00 Turkey time sync
 *
 * Workflow:
 * 1. Fetch products from supplier API to supplier_products table
 * 2. Validate all products (generate SKU, check price/stock/image)
 * 3. Sync only valid products to Shopify
 * 4. Set stock=0 for invalid products that were previously in Shopify
 *
 * Usage:
 *   bun run src/scripts/validate-and-sync.ts
 *   bun run src/scripts/validate-and-sync.ts --dry-run true
 *   bun run src/scripts/validate-and-sync.ts --categories tire,rim
 */

import { db, eq } from "@my-better-t-app/db";
import { supplierProducts, syncSessions } from "@my-better-t-app/db/schema";
import { validationService } from "../src/services/validationService";
import { ShopifyService } from "../src/services/shopifyService";
import { SupplierService } from "../src/services/supplierService";
import { PricingRulesService } from "../src/services/pricingRulesService";

interface CliArgs {
  categories: Array<"tire" | "rim" | "battery">;
  dryRun: boolean;
  skipFetch: boolean;
  limit?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    categories: ["tire", "rim", "battery"],
    dryRun: false,
    skipFetch: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--categories":
        if (nextArg) {
          const cats = nextArg.split(",").map((c) => c.trim().toLowerCase());
          result.categories = cats.filter((c) =>
            ["tire", "rim", "battery"].includes(c)
          ) as Array<"tire" | "rim" | "battery">;
        }
        i++;
        break;

      case "--dry-run":
        result.dryRun = nextArg === "true" || nextArg === "1";
        i++;
        break;

      case "--skip-fetch":
        result.skipFetch = nextArg === "true" || nextArg === "1";
        i++;
        break;

      case "--limit":
        if (nextArg) {
          const limit = parseInt(nextArg, 10);
          if (!isNaN(limit) && limit > 0) {
            result.limit = limit;
          }
        }
        i++;
        break;

      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Ruzgar Lastik Validate & Sync CLI

Usage: bun run src/scripts/validate-and-sync.ts [options]

Options:
  --categories <cats>     Comma-separated categories: tire,rim,battery (default: all)
  --dry-run <bool>        Dry run mode: true | false (default: false)
  --skip-fetch <bool>     Skip fetching from supplier API (default: false)
  --limit <n>             Limit number of products to sync (default: no limit)
  --help, -h              Show this help message

Examples:
  bun run src/scripts/validate-and-sync.ts
  bun run src/scripts/validate-and-sync.ts --dry-run true
  bun run src/scripts/validate-and-sync.ts --categories tire,rim --limit 100
`);
}

function validateEnvironment(): boolean {
  const required = [
    "SHOPIFY_SHOP_DOMAIN",
    "SHOPIFY_ACCESS_TOKEN",
    "SHOPIFY_LOCATION_ID",
    "DATABASE_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach((key) => console.error(`  - ${key}`));
    return false;
  }

  return true;
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Ruzgar Lastik Validate & Sync");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  const args = parseArgs();
  console.log("\nConfiguration:");
  console.log(`  Categories: ${args.categories.join(", ")}`);
  console.log(`  Dry Run: ${args.dryRun}`);
  console.log(`  Skip Fetch: ${args.skipFetch}`);
  if (args.limit) console.log(`  Limit: ${args.limit}`);

  if (!validateEnvironment()) {
    console.error("\nEnvironment validation failed. Exiting.");
    process.exit(1);
  }

  const useMock = process.env.USE_MOCK_SUPPLIER === "true";
  console.log(`\n  Supplier Mode: ${useMock ? "MOCK" : "LIVE"}`);

  // Create session
  const sessionId = crypto.randomUUID();
  await db.insert(syncSessions).values({
    id: sessionId,
    mode: "validate_and_sync",
    status: "running",
    stats: { categories: args.categories, dryRun: args.dryRun },
  });

  const stats = {
    fetched: 0,
    validated: 0,
    valid: 0,
    invalid: 0,
    synced: 0,
    failed: 0,
    deactivated: 0,
    errors: [] as string[],
  };

  try {
    // ===== STEP 1: Fetch products from supplier =====
    if (!args.skipFetch) {
      console.log("\n" + "-".repeat(40));
      console.log("Step 1: Fetching products from supplier...");
      console.log("-".repeat(40));

      const supplierService = new SupplierService({ useMock });

      for (const category of args.categories) {
        console.log(`\nFetching ${category}...`);
        const startTime = Date.now();

        try {
          const response = await supplierService.getProducts({ category });
          const products = response.products;
          console.log(`  Found ${products.length} products`);

          // Upsert to supplier_products table
          let created = 0;
          let updated = 0;

          for (const product of products) {
            const existing = await db
              .select()
              .from(supplierProducts)
              .where(eq(supplierProducts.supplierSku, product.supplierSku))
              .limit(1);

            if (existing.length > 0 && existing[0]) {
              // Update existing
              const oldProduct = existing[0];
              const priceChanged = oldProduct.currentPrice !== Math.round(product.price * 100);
              const stockChanged = oldProduct.currentStock !== product.stock;

              await db
                .update(supplierProducts)
                .set({
                  title: product.title,
                  brand: product.brand || null,
                  currentPrice: Math.round(product.price * 100),
                  currentStock: product.stock,
                  lastSeenAt: new Date(),
                  lastPriceChangeAt: priceChanged ? new Date() : oldProduct.lastPriceChangeAt,
                  lastStockChangeAt: stockChanged ? new Date() : oldProduct.lastStockChangeAt,
                  images: product.images || [],
                  metafields: product.metafields || {},
                  rawApiData: product,
                  isActive: true,
                  updatedAt: new Date(),
                  // Reset validation if data changed
                  validationStatus: priceChanged || stockChanged ? "raw" : oldProduct.validationStatus,
                })
                .where(eq(supplierProducts.supplierSku, product.supplierSku));

              updated++;
            } else {
              // Create new
              await db.insert(supplierProducts).values({
                supplierSku: product.supplierSku,
                category,
                title: product.title,
                brand: product.brand || null,
                currentPrice: Math.round(product.price * 100),
                currentStock: product.stock,
                images: product.images || [],
                metafields: product.metafields || {},
                rawApiData: product,
                validationStatus: "raw",
              });
              created++;
            }

            stats.fetched++;
          }

          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`  Created: ${created}, Updated: ${updated} (${duration}s)`);
        } catch (error: any) {
          const errorMsg = `[${category}] Fetch error: ${error.message}`;
          console.error(`  ERROR: ${error.message}`);
          stats.errors.push(errorMsg);
        }
      }
    } else {
      console.log("\nStep 1: Skipped (--skip-fetch)");
    }

    // ===== STEP 2: Validate all products =====
    console.log("\n" + "-".repeat(40));
    console.log("Step 2: Validating products...");
    console.log("-".repeat(40));

    for (const category of args.categories) {
      console.log(`\nValidating ${category}...`);
      const startTime = Date.now();

      try {
        const validationStats = await validationService.validateAll(category);
        stats.validated += validationStats.total;
        stats.valid += validationStats.valid + validationStats.published + validationStats.needsUpdate;
        stats.invalid += validationStats.invalid + validationStats.inactive;

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`  Total: ${validationStats.total}`);
        console.log(`  Valid: ${validationStats.valid}`);
        console.log(`  Invalid: ${validationStats.invalid}`);
        console.log(`  Published: ${validationStats.published}`);
        console.log(`  Needs Update: ${validationStats.needsUpdate}`);
        console.log(`  (${duration}s)`);

        if (Object.keys(validationStats.byReason).length > 0) {
          console.log(`  Reasons:`);
          for (const [reason, count] of Object.entries(validationStats.byReason)) {
            console.log(`    - ${reason}: ${count}`);
          }
        }
      } catch (error: any) {
        const errorMsg = `[${category}] Validation error: ${error.message}`;
        console.error(`  ERROR: ${error.message}`);
        stats.errors.push(errorMsg);
      }
    }

    // ===== STEP 3: Sync valid products to Shopify =====
    console.log("\n" + "-".repeat(40));
    console.log("Step 3: Syncing to Shopify...");
    console.log("-".repeat(40));

    if (args.dryRun) {
      console.log("\n  [DRY RUN] Skipping actual Shopify operations");
    } else {
      const shopifyService = new ShopifyService({
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN!,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
        locationId: process.env.SHOPIFY_LOCATION_ID!,
      });

      const pricingService = new PricingRulesService();

      // Get products that need syncing (valid or needs_update)
      let query = db
        .select()
        .from(supplierProducts)
        .where(eq(supplierProducts.validationStatus, "valid"));

      if (args.limit) {
        query = query.limit(args.limit) as typeof query;
      }

      const validProducts = await query;

      // Also get products that need update
      let updateQuery = db
        .select()
        .from(supplierProducts)
        .where(eq(supplierProducts.validationStatus, "needs_update"));

      if (args.limit) {
        updateQuery = updateQuery.limit(args.limit) as typeof updateQuery;
      }

      const updateProducts = await updateQuery;

      const allToSync = [...validProducts, ...updateProducts];
      console.log(`\n  Products to sync: ${allToSync.length}`);

      for (const product of allToSync) {
        try {
          const pricingResult = await pricingService.applyPricing(
            (product.currentPrice || 0) / 100,
            product.category as "tire" | "rim" | "battery",
            product.brand || undefined
          );

          if (product.shopifyProductId) {
            // Update existing
            const existingProduct = await shopifyService.getProductBySku(product.supplierSku);
            if (existingProduct && existingProduct.variants[0]) {
              const variant = existingProduct.variants[0];

              // Update price
              await shopifyService.updateVariant({
                id: variant.id,
                price: pricingResult.finalPrice.toString(),
              });

              // Update inventory
              if (variant.inventoryItem?.id) {
                await shopifyService.updateInventory({
                  inventoryItemId: variant.inventoryItem.id,
                  locationId: process.env.SHOPIFY_LOCATION_ID!,
                  availableQuantity: product.currentStock || 0,
                });
              }

              // Update DB
              await db
                .update(supplierProducts)
                .set({
                  validationStatus: "published",
                  lastSyncedPrice: product.currentPrice,
                  lastSyncedStock: product.currentStock,
                  lastSyncedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(supplierProducts.id, product.id));

              stats.synced++;
            }
          } else {
            // Create new product
            const createdProduct = await shopifyService.createProduct({
              title: product.title,
              vendor: product.brand || "",
              productType: product.category,
              status: "ACTIVE",
              variants: [
                {
                  sku: product.generatedSku || product.supplierSku,
                  price: pricingResult.finalPrice.toString(),
                  barcode: product.barcode || undefined,
                },
              ],
              images: product.images?.map((src: string) => ({ src })),
            });

            const createdVariant = createdProduct.variants?.[0];

            // Update inventory
            if (createdVariant?.inventoryItem?.id) {
              await shopifyService.updateInventory({
                inventoryItemId: createdVariant.inventoryItem.id,
                locationId: process.env.SHOPIFY_LOCATION_ID!,
                availableQuantity: product.currentStock || 0,
              });
            }

            // Update DB
            await db
              .update(supplierProducts)
              .set({
                validationStatus: "published",
                shopifyProductId: createdProduct.id,
                shopifyVariantId: createdVariant?.id || null,
                shopifyInventoryItemId: createdVariant?.inventoryItem?.id || null,
                lastSyncedPrice: product.currentPrice,
                lastSyncedStock: product.currentStock,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(supplierProducts.id, product.id));

            stats.synced++;
          }
        } catch (error: any) {
          stats.failed++;
          stats.errors.push(`${product.supplierSku}: ${error.message}`);
        }
      }

      // ===== STEP 4: Deactivate invalid products in Shopify =====
      console.log("\n  Deactivating invalid products...");

      const inactiveProducts = await db
        .select()
        .from(supplierProducts)
        .where(eq(supplierProducts.validationStatus, "inactive"));

      for (const product of inactiveProducts) {
        if (product.shopifyVariantId && product.shopifyInventoryItemId) {
          try {
            // Set stock to 0
            await shopifyService.updateInventory({
              inventoryItemId: product.shopifyInventoryItemId,
              locationId: process.env.SHOPIFY_LOCATION_ID!,
              availableQuantity: 0,
            });

            stats.deactivated++;
          } catch (error: any) {
            stats.errors.push(`Deactivate ${product.supplierSku}: ${error.message}`);
          }
        }
      }
    }

    // Update session
    await db
      .update(syncSessions)
      .set({
        status: stats.errors.length > 0 ? "completed_with_errors" : "completed",
        finishedAt: new Date(),
        stats,
      })
      .where(eq(syncSessions.id, sessionId));

    // Print results
    console.log("\n" + "=".repeat(60));
    console.log("Summary");
    console.log("=".repeat(60));
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  Fetched: ${stats.fetched}`);
    console.log(`  Validated: ${stats.validated}`);
    console.log(`  Valid: ${stats.valid}`);
    console.log(`  Invalid: ${stats.invalid}`);
    console.log(`  Synced: ${stats.synced}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Deactivated: ${stats.deactivated}`);

    if (stats.errors.length > 0) {
      console.log(`\n  Errors (${stats.errors.length} total):`);
      stats.errors.slice(0, 10).forEach((err, i) => {
        console.log(`    ${i + 1}. ${err}`);
      });
      if (stats.errors.length > 10) {
        console.log(`    ... and ${stats.errors.length - 10} more`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`Finished at: ${new Date().toISOString()}`);
    console.log("=".repeat(60));

    // Exit codes
    if (stats.failed > 0) {
      process.exit(2); // Partial success
    } else if (stats.errors.length > 0) {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("\nFatal error:");
    console.error((error as Error).message);
    console.error((error as Error).stack);

    await db
      .update(syncSessions)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorSummary: (error as Error).message,
      })
      .where(eq(syncSessions.id, sessionId));

    process.exit(1);
  }
}

// Run
main();
