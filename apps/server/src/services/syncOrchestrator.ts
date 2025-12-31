import { db, eq, and, isNotNull, sqlFn } from "@my-better-t-app/db";
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
  validateFirst?: boolean;
  onlyValid?: boolean;
}

export interface SyncResult {
  sessionId: string;
  status: "completed" | "failed" | "running";
  totalProducts: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  deactivated: number;
  validated: number;
  validCount: number;
  invalidCount: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

export class SyncOrchestrator {
  private supplierService: SupplierService | undefined;
  private shopifyService: ShopifyService;
  private titleParser: TitleParserService;
  private pricingService: PricingRulesService;
  private cacheService: CacheService;

  constructor(config: {
    supplierService?: SupplierService;
    shopifyService: ShopifyService;
  }) {
    this.supplierService = config.supplierService;
    this.shopifyService = config.shopifyService;
    this.titleParser = new TitleParserService();
    this.pricingService = new PricingRulesService();
    this.cacheService = new CacheService();
  }

  /**
   * Tedarikçi verilerini yerel havuza (DB) akıtır.
   */
  async ingest(config: SyncConfig, jobId?: number): Promise<{ totalFetched: number, failed: number }> {
    if (!this.supplierService) {
      throw new Error("SupplierService is required for ingestion");
    }

    const categories = config.categories || ["tire", "rim", "battery"];
    let totalFetched = 0;
    let failed = 0;

    for (const category of categories) {
      const result = await this.supplierService.fetchAndIngest(category, jobId);
      totalFetched += result.totalFetched;
      failed += result.failed;
    }

    return { totalFetched, failed };
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

      // PHASE 1: INGESTION (Tedarikçi -> DB)
      if (config.mode !== "validation-only" && this.supplierService) {
        console.log("[Sync] Phase 1: Starting Ingestion...");
        const ingestStats = await this.ingest(config);
        console.log(`[Sync] Ingested ${ingestStats.totalFetched} products.`);
      }

      // PHASE 2: PROCESSING (DB -> Shopify)
      console.log("[Sync] Phase 2: Starting Processing...");

      // Count total products
      const countResult = await db
        .select({ count: sqlFn<number>`count(*)::int` })
        .from(supplierProducts)
        .where(config.categories ? and(...config.categories.map(c => eq(supplierProducts.category, c))) : undefined);
      
      result.totalProducts = countResult[0]?.count || 0;

      // STEP 2: Validate all products
      if (config.validateFirst || config.mode === "validation-only") {
        console.log("[Sync] Running validation...");
        for (const category of categories) {
          const validationStats = await validationService.validateAll(category);
          result.validated += validationStats.total;
          result.validCount += validationStats.valid + validationStats.published + validationStats.needsUpdate;
          result.invalidCount += validationStats.invalid + validationStats.inactive;
        }

        if (config.mode === "validation-only") {
          result.status = "completed";
          result.completedAt = new Date();
          await this.updateSessionStatus(sessionId, result);
          return result;
        }
      }

      // STEP 3: Sync to Shopify
      // 3a: Create New
      const newValidProducts = await db.select()
        .from(supplierProducts)
        .where(and(
          eq(supplierProducts.validationStatus, "valid"),
          eq(supplierProducts.shopifyProductId, null as any)
        ));

      console.log(`[Sync] Creating ${newValidProducts.length} new products...`);
      for (const product of newValidProducts) {
        if (config.dryRun) { result.skipped++; continue; }
        try { await this.syncNewProduct(product, sessionId, config); result.created++; }
        catch (e) { result.failed++; result.errors.push(`${product.supplierSku}: ${(e as Error).message}`); }
      }

      // 3b: Update Existing
      const productsToUpdate = await db.select()
        .from(supplierProducts)
        .where(eq(supplierProducts.validationStatus, "needs_update"));

      console.log(`[Sync] Updating ${productsToUpdate.length} products...`);
      for (const product of productsToUpdate) {
        if (config.dryRun) { result.skipped++; continue; }
        try { await this.updateExistingProduct(product, sessionId); result.updated++; }
        catch (e) { result.failed++; result.errors.push(`${product.supplierSku}: ${(e as Error).message}`); }
      }

      // 3c: Deactivate
      const productsToDeactivate = await db.select()
        .from(supplierProducts)
        .where(and(
          eq(supplierProducts.validationStatus, "inactive"),
          isNotNull(supplierProducts.shopifyProductId)
        ));

      console.log(`[Sync] Deactivating ${productsToDeactivate.length} products...`);
      for (const product of productsToDeactivate) {
        if (config.dryRun) { result.skipped++; continue; }
        try { await this.deactivateProduct(product, sessionId); result.deactivated++; }
        catch (e) { result.failed++; result.errors.push(`${product.supplierSku}: ${(e as Error).message}`); }
      }

      result.status = "completed";
      result.completedAt = new Date();
      await this.updateSessionStatus(sessionId, result);

    } catch (error) {
      console.error("[Sync] Orchestrator Error:", error);
      result.status = "failed";
      result.errors.push((error as Error).message);
      await db.update(syncSessions).set({
        status: "failed",
        finishedAt: new Date(),
        errorSummary: (error as Error).message,
      }).where(eq(syncSessions.id, sessionId));
    }

    return result;
  }

  private async updateSessionStatus(sessionId: string, result: SyncResult) {
    await db.update(syncSessions).set({
      status: result.status,
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
    }).where(eq(syncSessions.id, sessionId));
  }

  private async syncNewProduct(product: any, sessionId: string, _config: SyncConfig): Promise<void> {
    const enrichedMetafields = this.titleParser.enrichMetafields(
      product.category,
      product.title,
      product.metafields
    );

    const pricingResult = await this.pricingService.applyPricing(
      product.currentPrice,
      product.category,
      product.brand ?? undefined
    );

    const createdProduct = await this.shopifyService.createProduct({
      title: product.title,
      descriptionHtml: product.description || "",
      vendor: product.brand || "",
      productType: product.category,
      status: "ACTIVE",
      variants: [
        {
          sku: product.generatedSku || product.supplierSku,
          price: (pricingResult.finalPrice / 100).toString(), // TL'ye çevir
          barcode: product.barcode || undefined,
        },
      ],
      images: (product.images || []).map((src: string) => ({ src })),
    });

    const metafieldsList = Object.entries(enrichedMetafields).map(([key, value]) => ({
      namespace: "custom",
      key,
      value: String(value),
      type: this.getMetafieldType(value),
    }));

    if (metafieldsList.length > 0) {
      await this.shopifyService.setMetafields(createdProduct.id, metafieldsList);
    }

    if (createdProduct.variants?.[0]?.inventoryItem?.id) {
      await this.shopifyService.updateInventory({
        inventoryItemId: createdProduct.variants[0].inventoryItem.id,
        locationId: process.env.SHOPIFY_LOCATION_ID!,
        availableQuantity: product.currentStock,
      });
    }

    await db.update(supplierProducts).set({
      validationStatus: "published",
      shopifyProductId: createdProduct.id,
      shopifyVariantId: createdProduct.variants?.[0]?.id,
      shopifyInventoryItemId: createdProduct.variants?.[0]?.inventoryItem?.id,
      lastSyncedPrice: product.currentPrice,
      lastSyncedStock: product.currentStock,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(supplierProducts.id, product.id));

    await db.insert(productMap).values({
      sku: product.supplierSku,
      shopifyId: createdProduct.id,
      category: product.category,
      lastSyncAt: new Date(),
    }).onConflictDoUpdate({
      target: productMap.sku,
      set: { shopifyId: createdProduct.id, lastSyncAt: new Date() },
    });

    await db.insert(syncItems).values({
      sessionId,
      sku: product.supplierSku,
      action: "create",
      message: "success",
      details: { shopifyId: createdProduct.id, price: pricingResult.finalPrice, stock: product.currentStock },
    });
  }

  private async updateExistingProduct(product: any, sessionId: string): Promise<void> {
    if (!product.shopifyVariantId || !product.shopifyInventoryItemId) return;

    const priceChanged = product.currentPrice !== product.lastSyncedPrice;
    const stockChanged = product.currentStock !== product.lastSyncedStock;

    if (!priceChanged && !stockChanged) {
      await db.update(supplierProducts).set({ validationStatus: "published", updatedAt: new Date() }).where(eq(supplierProducts.id, product.id));
      return;
    }

    if (priceChanged) {
      const pricingResult = await this.pricingService.applyPricing(product.currentPrice, product.category, product.brand ?? undefined);
      await this.shopifyService.updateVariant({ id: product.shopifyVariantId, price: (pricingResult.finalPrice / 100).toString() });
    }

    if (stockChanged) {
      await this.shopifyService.updateInventory({
        inventoryItemId: product.shopifyInventoryItemId,
        locationId: process.env.SHOPIFY_LOCATION_ID!,
        availableQuantity: product.currentStock,
      });
    }

    await db.update(supplierProducts).set({
      validationStatus: "published",
      lastSyncedPrice: product.currentPrice,
      lastSyncedStock: product.currentStock,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(supplierProducts.id, product.id));

    await db.insert(syncItems).values({
      sessionId,
      sku: product.supplierSku,
      action: "update",
      message: "success",
      details: { priceChanged, stockChanged, newPrice: product.currentPrice, newStock: product.currentStock },
    });
  }

  private async deactivateProduct(product: any, sessionId: string): Promise<void> {
    if (!product.shopifyInventoryItemId) return;

    await this.shopifyService.updateInventory({
      inventoryItemId: product.shopifyInventoryItemId,
      locationId: process.env.SHOPIFY_LOCATION_ID!,
      availableQuantity: 0,
    });

    await db.update(supplierProducts).set({
      validationStatus: "inactive",
      lastSyncedStock: 0,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(supplierProducts.id, product.id));

    await db.insert(syncItems).values({
      sessionId,
      sku: product.supplierSku,
      action: "deactivate" as any,
      message: "success",
      details: { previousStock: product.currentStock },
    });
  }

  private getMetafieldType(value: any): string {
    if (typeof value === "number") return Number.isInteger(value) ? "number_integer" : "number_decimal";
    return "single_line_text_field";
  }

  async getSyncStatus(sessionId: string) {
    const session = await db.select().from(syncSessions).where(eq(syncSessions.id, sessionId)).limit(1);
    if (!session.length) throw new Error(`Sync session ${sessionId} not found`);
    const items = await db.select().from(syncItems).where(eq(syncItems.sessionId, sessionId));
    return { session: session[0], items };
  }
}