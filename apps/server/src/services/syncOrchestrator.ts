import { db, eq, and, isNotNull } from "@my-better-t-app/db";
import { productMap, syncSessions, syncItems, supplierProducts } from "@my-better-t-app/db/schema";
import type { SupplierService } from "./supplierService";
import { ShopifyService } from "./shopifyService";
import { TitleParserService } from "./titleParserService";
import { PricingRulesService } from "./pricingRulesService";
import { CacheService } from "./cacheService";
import { validationService } from "./validationService";

export interface SyncConfig {
  mode: "full" | "incremental" | "validation-only";
  categories?: Array<"tire" | "rim" | "battery">;
  dryRun?: boolean;
  batchSize?: number;
  maxRetries?: number;
  validateFirst?: boolean; // Önce validasyon yap
  onlyValid?: boolean; // Sadece valid ürünleri sync et
}

export interface SyncResult {
  sessionId: string;
  status: "completed" | "failed" | "running";
  totalProducts: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  deactivated: number; // Stok=0 yapılan ürünler
  validated: number; // Validate edilen ürün sayısı
  validCount: number; // Geçerli ürün sayısı
  invalidCount: number; // Geçersiz ürün sayısı
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

export class SyncOrchestrator {
  private shopifyService: ShopifyService;
  private titleParser: TitleParserService;
  private pricingService: PricingRulesService;
  private cacheService: CacheService;

  constructor(config: {
    supplierService?: SupplierService;  // Reserved for future direct API access
    shopifyService: ShopifyService;
  }) {
    // supplierService is reserved for future use when direct API access is needed
    void config.supplierService;
    this.shopifyService = config.shopifyService;
    this.titleParser = new TitleParserService();
    this.pricingService = new PricingRulesService();
    this.cacheService = new CacheService();
  }

  async startSync(config: SyncConfig): Promise<SyncResult> {
    const sessionId = crypto.randomUUID();
    const startedAt = new Date();

    const result: SyncResult = {
      sessionId,
      status: "running",
      totalProducts: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      deactivated: 0,
      validated: 0,
      validCount: 0,
      invalidCount: 0,
      errors: [],
      startedAt,
    };

    try {
      await db.insert(syncSessions).values({
        id: sessionId,
        mode: config.mode,
        status: "running",
        stats: { config },
      });

      const categories = config.categories || ["tire", "rim", "battery"];

      // STEP 1: Fetch products to cache (from supplier API or existing cache)
      for (const category of categories) {
        const forceRefresh = config.mode === "full";

        const { products: cachedProducts, fromCache } = await this.cacheService.getCachedProducts({
          category,
          limit: config.batchSize || 1000, // Get all products for validation
          forceRefresh,
        });

        console.log(`[Sync] ${category}: ${cachedProducts.length} products ${fromCache ? "from cache" : "freshly fetched"}`);
        result.totalProducts += cachedProducts.length;
      }

      // STEP 2: Validate all products (if validateFirst is enabled or mode is validation-only)
      if (config.validateFirst || config.mode === "validation-only") {
        console.log("[Sync] Running validation on all products...");

        for (const category of categories) {
          const validationStats = await validationService.validateAll(category);
          result.validated += validationStats.total;
          result.validCount += validationStats.valid + validationStats.published + validationStats.needsUpdate;
          result.invalidCount += validationStats.invalid + validationStats.inactive;
        }

        console.log(`[Sync] Validation complete: ${result.validCount} valid, ${result.invalidCount} invalid`);

        // If validation-only mode, stop here
        if (config.mode === "validation-only") {
          result.status = "completed";
          result.completedAt = new Date();

          await db.update(syncSessions)
            .set({
              status: "completed",
              finishedAt: result.completedAt,
              stats: {
                totalProducts: result.totalProducts,
                validated: result.validated,
                validCount: result.validCount,
                invalidCount: result.invalidCount,
              },
            })
            .where(eq(syncSessions.id, sessionId));

          return result;
        }
      }

      // STEP 3: Sync products to Shopify based on validation status
      // 3a: Create new products (valid + no shopifyProductId)
      const newValidProducts = await db.select()
        .from(supplierProducts)
        .where(and(
          eq(supplierProducts.validationStatus, "valid"),
          eq(supplierProducts.shopifyProductId, null as any)
        ));

      console.log(`[Sync] Creating ${newValidProducts.length} new products in Shopify...`);

      for (const product of newValidProducts) {
        if (config.dryRun) {
          result.skipped++;
          continue;
        }

        try {
          await this.syncNewProduct(product, sessionId, config);
          result.created++;
        } catch (error) {
          result.failed++;
          result.errors.push(`${product.supplierSku}: ${(error as Error).message}`);
        }
      }

      // 3b: Update existing products (needs_update status)
      const productsToUpdate = await db.select()
        .from(supplierProducts)
        .where(eq(supplierProducts.validationStatus, "needs_update"));

      console.log(`[Sync] Updating ${productsToUpdate.length} existing products...`);

      for (const product of productsToUpdate) {
        if (config.dryRun) {
          result.skipped++;
          continue;
        }

        try {
          await this.updateExistingProduct(product, sessionId);
          result.updated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`${product.supplierSku}: ${(error as Error).message}`);
        }
      }

      // 3c: Deactivate invalid products that were previously published
      const productsToDeactivate = await db.select()
        .from(supplierProducts)
        .where(and(
          eq(supplierProducts.validationStatus, "inactive"),
          isNotNull(supplierProducts.shopifyProductId)
        ));

      console.log(`[Sync] Deactivating ${productsToDeactivate.length} invalid products...`);

      for (const product of productsToDeactivate) {
        if (config.dryRun) {
          result.skipped++;
          continue;
        }

        try {
          await this.deactivateProduct(product, sessionId);
          result.deactivated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`${product.supplierSku}: ${(error as Error).message}`);
        }
      }

      result.status = "completed";
      result.completedAt = new Date();

      await db
        .update(syncSessions)
        .set({
          status: "completed",
          finishedAt: result.completedAt,
          stats: {
            totalProducts: result.totalProducts,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
            deactivated: result.deactivated,
            validated: result.validated,
            validCount: result.validCount,
            invalidCount: result.invalidCount,
          },
        })
        .where(eq(syncSessions.id, sessionId));
    } catch (error) {
      result.status = "failed";
      result.errors.push((error as Error).message);

      await db
        .update(syncSessions)
        .set({
          status: "failed",
          finishedAt: new Date(),
          errorSummary: (error as Error).message,
        })
        .where(eq(syncSessions.id, sessionId));
    }

    return result;
  }

  /**
   * Yeni ürünü Shopify'a ekle
   */
  private async syncNewProduct(
    product: typeof supplierProducts.$inferSelect,
    sessionId: string,
    _config: SyncConfig
  ): Promise<void> {
    // Metafields'ı zenginleştir
    const enrichedMetafields = this.titleParser.enrichMetafields(
      product.category as "tire" | "rim" | "battery",
      product.title,
      product.metafields as Record<string, any>
    );

    // Fiyatlandırma uygula
    const pricingResult = await this.pricingService.applyPricing(
      product.currentPrice,
      product.category as "tire" | "rim" | "battery",
      product.brand ?? undefined
    );

    // Shopify'da ürün oluştur
    const createdProduct = await this.shopifyService.createProduct({
      title: product.title,
      descriptionHtml: product.description || "",
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
      images: (product.images as string[] || []).map((src) => ({ src })),
    });

    // Metafields ekle
    const metafieldsList = Object.entries(enrichedMetafields).map(
      ([key, value]) => ({
        namespace: "custom",
        key,
        value: String(value),
        type: this.getMetafieldType(value),
      })
    );

    if (metafieldsList.length > 0) {
      await this.shopifyService.setMetafields(createdProduct.id, metafieldsList);
    }

    // Inventory set et
    if (createdProduct.variants?.[0]?.inventoryItem?.id) {
      try {
        await this.shopifyService.updateInventory({
          inventoryItemId: createdProduct.variants[0].inventoryItem.id,
          locationId: process.env.SHOPIFY_LOCATION_ID!,
          availableQuantity: product.currentStock,
        });
      } catch (e) {
        console.warn(`[Sync] Inventory update failed for ${product.supplierSku}:`, e);
      }
    }

    // DB'yi güncelle
    await db.update(supplierProducts)
      .set({
        validationStatus: "published",
        shopifyProductId: createdProduct.id,
        shopifyVariantId: createdProduct.variants?.[0]?.id,
        shopifyInventoryItemId: createdProduct.variants?.[0]?.inventoryItem?.id,
        lastSyncedPrice: product.currentPrice,
        lastSyncedStock: product.currentStock,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supplierProducts.id, product.id));

    // productMap tablosuna da ekle (backward compatibility)
    await db.insert(productMap).values({
      sku: product.supplierSku,
      shopifyId: createdProduct.id,
      category: product.category,
      lastSyncAt: new Date(),
    }).onConflictDoUpdate({
      target: productMap.sku,
      set: {
        shopifyId: createdProduct.id,
        lastSyncAt: new Date(),
      },
    });

    // Sync item log
    await db.insert(syncItems).values({
      sessionId,
      sku: product.supplierSku,
      action: "create",
      message: "success",
      details: {
        shopifyId: createdProduct.id,
        price: pricingResult.finalPrice,
        stock: product.currentStock,
      },
    });
  }

  /**
   * Mevcut ürünü güncelle (sadece fiyat/stok değişmişse)
   */
  private async updateExistingProduct(
    product: typeof supplierProducts.$inferSelect,
    sessionId: string
  ): Promise<void> {
    if (!product.shopifyVariantId || !product.shopifyInventoryItemId) {
      console.warn(`[Sync] Missing Shopify IDs for ${product.supplierSku}, skipping update`);
      return;
    }

    const priceChanged = product.currentPrice !== product.lastSyncedPrice;
    const stockChanged = product.currentStock !== product.lastSyncedStock;

    if (!priceChanged && !stockChanged) {
      // Değişiklik yok, sadece status güncelle
      await db.update(supplierProducts)
        .set({
          validationStatus: "published",
          updatedAt: new Date(),
        })
        .where(eq(supplierProducts.id, product.id));
      return;
    }

    // Fiyat değişmişse variant güncelle
    if (priceChanged) {
      const pricingResult = await this.pricingService.applyPricing(
        product.currentPrice,
        product.category as "tire" | "rim" | "battery",
        product.brand ?? undefined
      );

      await this.shopifyService.updateVariant({
        id: product.shopifyVariantId,
        price: pricingResult.finalPrice.toString(),
      });
    }

    // Stok değişmişse inventory güncelle
    if (stockChanged) {
      await this.shopifyService.updateInventory({
        inventoryItemId: product.shopifyInventoryItemId,
        locationId: process.env.SHOPIFY_LOCATION_ID!,
        availableQuantity: product.currentStock,
      });
    }

    // DB'yi güncelle
    await db.update(supplierProducts)
      .set({
        validationStatus: "published",
        lastSyncedPrice: product.currentPrice,
        lastSyncedStock: product.currentStock,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supplierProducts.id, product.id));

    // Sync item log
    await db.insert(syncItems).values({
      sessionId,
      sku: product.supplierSku,
      action: "update",
      message: "success",
      details: {
        priceChanged,
        stockChanged,
        newPrice: product.currentPrice,
        newStock: product.currentStock,
      },
    });
  }

  /**
   * Geçersiz ürünü pasif yap (stok=0)
   */
  private async deactivateProduct(
    product: typeof supplierProducts.$inferSelect,
    sessionId: string
  ): Promise<void> {
    if (!product.shopifyInventoryItemId) {
      console.warn(`[Sync] Missing inventory item ID for ${product.supplierSku}, skipping deactivation`);
      return;
    }

    // Stok'u 0 yap
    await this.shopifyService.updateInventory({
      inventoryItemId: product.shopifyInventoryItemId,
      locationId: process.env.SHOPIFY_LOCATION_ID!,
      availableQuantity: 0,
    });

    // DB'yi güncelle
    await db.update(supplierProducts)
      .set({
        validationStatus: "inactive",
        lastSyncedStock: 0,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supplierProducts.id, product.id));

    // Sync item log
    await db.insert(syncItems).values({
      sessionId,
      sku: product.supplierSku,
      action: "deactivate" as any,
      message: "success",
      details: {
        reason: (product.validationErrors as any[])?.[0]?.message || "Geçersiz ürün",
        previousStock: product.currentStock,
      },
    });
  }

  private getMetafieldType(value: any): string {
    if (typeof value === "number") {
      return Number.isInteger(value) ? "number_integer" : "number_decimal";
    }
    return "single_line_text_field";
  }

  async getSyncStatus(sessionId: string) {
    const session = await db
      .select()
      .from(syncSessions)
      .where(eq(syncSessions.id, sessionId))
      .limit(1);

    if (!session.length) {
      throw new Error(`Sync session ${sessionId} not found`);
    }

    const items = await db
      .select()
      .from(syncItems)
      .where(eq(syncItems.sessionId, sessionId));

    return {
      session: session[0],
      items,
    };
  }
}
