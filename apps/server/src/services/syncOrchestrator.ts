import { db } from "@workspace/db/client";
import { productMap, syncSessions, syncItems } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  SupplierService,
  type SupplierProduct,
} from "./supplierService";
import { ShopifyService } from "./shopifyService";
import { TitleParserService } from "./titleParserService";
import { PricingRulesService } from "./pricingRulesService";

export interface SyncConfig {
  mode: "full" | "incremental";
  categories?: Array<"tire" | "rim" | "battery">;
  dryRun?: boolean;
  batchSize?: number;
  maxRetries?: number;
}

export interface SyncResult {
  sessionId: string;
  status: "completed" | "failed" | "running";
  totalProducts: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

export class SyncOrchestrator {
  private supplierService: SupplierService;
  private shopifyService: ShopifyService;
  private titleParser: TitleParserService;
  private pricingService: PricingRulesService;

  constructor(config: {
    supplierService: SupplierService;
    shopifyService: ShopifyService;
  }) {
    this.supplierService = config.supplierService;
    this.shopifyService = config.shopifyService;
    this.titleParser = new TitleParserService();
    this.pricingService = new PricingRulesService();
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
      errors: [],
      startedAt,
    };

    try {
      await db.insert(syncSessions).values({
        id: sessionId,
        mode: config.mode,
        status: "running",
        startedAt,
        config: config as any,
      });

      const categories = config.categories || ["tire", "rim", "battery"];
      
      for (const category of categories) {
        const supplierProducts = await this.supplierService.getProducts({
          category,
          limit: config.batchSize || 50,
        });

        result.totalProducts += supplierProducts.products.length;

        for (const supplierProduct of supplierProducts.products) {
          try {
            await this.syncProduct(supplierProduct, sessionId, config);
            result.created++;
          } catch (error) {
            result.failed++;
            result.errors.push(
              `${supplierProduct.supplierSku}: ${(error as Error).message}`
            );
          }
        }
      }

      result.status = "completed";
      result.completedAt = new Date();

      await db
        .update(syncSessions)
        .set({
          status: "completed",
          completedAt: result.completedAt,
          totalProducts: result.totalProducts,
          createdCount: result.created,
          updatedCount: result.updated,
          failedCount: result.failed,
        })
        .where(eq(syncSessions.id, sessionId));
    } catch (error) {
      result.status = "failed";
      result.errors.push((error as Error).message);

      await db
        .update(syncSessions)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: (error as Error).message,
        })
        .where(eq(syncSessions.id, sessionId));
    }

    return result;
  }

  private async syncProduct(
    supplierProduct: SupplierProduct,
    sessionId: string,
    config: SyncConfig
  ): Promise<void> {
    const enrichedMetafields = this.titleParser.enrichMetafields(
      supplierProduct.category,
      supplierProduct.title,
      supplierProduct.metafields
    );

    const pricingResult = await this.pricingService.applyPricing(
      supplierProduct.price,
      supplierProduct.category,
      supplierProduct.brand
    );

    const existingMapping = await db
      .select()
      .from(productMap)
      .where(eq(productMap.supplierSku, supplierProduct.supplierSku))
      .limit(1);

    let action: "create" | "update" = "create";
    let shopifyProductId: string | undefined;

    if (existingMapping.length > 0 && existingMapping[0]?.shopifyProductId) {
      action = "update";
      shopifyProductId = existingMapping[0].shopifyProductId;
    }

    if (config.dryRun) {
      await db.insert(syncItems).values({
        id: crypto.randomUUID(),
        sessionId,
        supplierSku: supplierProduct.supplierSku,
        action,
        status: "skipped",
        metadata: {
          dryRun: true,
          price: pricingResult.finalPrice,
          metafields: enrichedMetafields,
        },
      });
      return;
    }

    try {
      if (action === "create") {
        const createdProduct = await this.shopifyService.createProduct({
          title: supplierProduct.title,
          descriptionHtml: supplierProduct.description,
          vendor: supplierProduct.brand,
          productType: supplierProduct.category,
          status: "ACTIVE",
          variants: [
            {
              sku: supplierProduct.supplierSku,
              price: pricingResult.finalPrice.toString(),
              barcode: supplierProduct.barcode,
            },
          ],
          images: supplierProduct.images?.map((src) => ({ src })),
        });

        shopifyProductId = createdProduct.id;

        const metafieldsList = Object.entries(enrichedMetafields).map(
          ([key, value]) => ({
            namespace: "custom",
            key,
            value: String(value),
            type: this.getMetafieldType(value),
          })
        );

        if (metafieldsList.length > 0) {
          await this.shopifyService.setMetafields(shopifyProductId, metafieldsList);
        }

        await db.insert(productMap).values({
          id: crypto.randomUUID(),
          supplierSku: supplierProduct.supplierSku,
          shopifyProductId,
          category: supplierProduct.category,
          lastSyncedAt: new Date(),
          syncStatus: "synced",
        });
      }

      await db.insert(syncItems).values({
        id: crypto.randomUUID(),
        sessionId,
        supplierSku: supplierProduct.supplierSku,
        action,
        status: "success",
        shopifyProductId,
      });
    } catch (error) {
      await db.insert(syncItems).values({
        id: crypto.randomUUID(),
        sessionId,
        supplierSku: supplierProduct.supplierSku,
        action,
        status: "failed",
        errorMessage: (error as Error).message,
      });
      throw error;
    }
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
