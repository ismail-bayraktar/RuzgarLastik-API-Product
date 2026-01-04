import { protectedProcedure, router } from "../index";
import { db, eq, desc, sqlFn, inArray } from "@my-better-t-app/db";
import { apiTestLogs, productsCache, cacheMetadata, syncSessions, syncItems, productMap, supplierProducts } from "@my-better-t-app/db/schema";
import { z } from "zod";
import { SyncOrchestrator, type SyncConfig } from "../../../../apps/web/src/services/syncOrchestrator";
import { SupplierService } from "../../../../apps/web/src/services/supplierService";
import { ShopifyService } from "../../../../apps/web/src/services/shopifyService";
import { PricingRulesService } from "../../../../apps/web/src/services/pricingRulesService";
import { TitleParserService } from "../../../../apps/web/src/services/titleParserService";
import { validationService } from "../../../../apps/web/src/services/validationService";

interface SyncStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  message?: string;
  duration?: number;
  data?: any;
}

interface ProductPreview {
  supplierSku: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  calculatedPrice?: number;
  stock: number;
  status: "pending" | "success" | "error" | "skipped";
  error?: string;
}

interface CachedProductsResult {
  products: any[];
  fromCache: boolean;
  lastFetchAt: Date | null;
  rateLimitError?: {
    waitSeconds: number;
    message: string;
    category: string;
  };
  errors: string[];
}

async function getCachedProducts(categories: string[], limit: number, forceRefresh = false): Promise<CachedProductsResult> {
  if (!forceRefresh) {
    let allValid = true;
    for (const cat of categories) {
      const meta = await db.select().from(cacheMetadata).where(eq(cacheMetadata.category, cat)).limit(1);
      if (!meta[0]?.lastFetchAt) {
        allValid = false;
        break;
      }
      const hoursSince = (Date.now() - new Date(meta[0].lastFetchAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince > (meta[0].refreshIntervalHours || 6)) {
        allValid = false;
        break;
      }
    }

    if (allValid) {
      let products: any[] = [];
      for (const cat of categories) {
        const cached = await db.select().from(productsCache).where(eq(productsCache.category, cat));
        products = products.concat(cached.map(p => ({
          supplierSku: String(p.supplierSku || "unknown"),
          title: String(p.title || "Untitled"),
          brand: p.brand || "",
          category: String(p.category || cat),
          price: (p.price || 0) / 100,
          stock: p.stock || 0,
        })));
      }

      const oldestMeta = await db.select().from(cacheMetadata).orderBy(cacheMetadata.lastFetchAt).limit(1);
      return {
        products: products.slice(0, limit),
        fromCache: true,
        lastFetchAt: oldestMeta[0]?.lastFetchAt || null,
        errors: [],
      };
    }
  }

  const freshProducts: any[] = [];
  const useMock = process.env.USE_MOCK_SUPPLIER === "true";
  const fetchErrors: string[] = [];
  let rateLimitError: CachedProductsResult["rateLimitError"] = undefined;

  for (const category of categories) {
    const startTime = Date.now();

    try {
      await db.insert(cacheMetadata).values({ category, status: "fetching" })
        .onConflictDoUpdate({ target: cacheMetadata.category, set: { status: "fetching", updatedAt: new Date() } });

      let categoryProducts: any[] = [];

      if (useMock) {
        const mockData = await import("../../../../apps/web/data/mock-products.json");
        const mockProducts = category === "tire" ? mockData.default.tires :
                            category === "rim" ? mockData.default.rims :
                            mockData.default.batteries;
        categoryProducts = mockProducts.map((p: any) => ({
          supplierSku: p.supplierSku,
          title: p.title,
          brand: p.brand,
          category,
          price: p.price,
          stock: p.stock,
        }));
      } else {
        const url = category === "tire" ? process.env.SUPPLIER_API_LASTIK :
                    category === "rim" ? process.env.SUPPLIER_API_JANT :
                    process.env.SUPPLIER_API_AKU;

        if (url) {
          const response = await fetch(url);

          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitSeconds = retryAfter ? parseInt(retryAfter) : 60;

            await db.update(cacheMetadata)
              .set({
                status: "rate_limited",
                errorMessage: `Rate limit: ${waitSeconds} saniye bekleyin`,
                updatedAt: new Date()
              })
              .where(eq(cacheMetadata.category, category));

            throw new Error(`RATE_LIMIT:${waitSeconds}:Tedarikçi API rate limit. ${waitSeconds} saniye sonra tekrar deneyin.`);
          }

          if (!response.ok) {
            throw new Error(`API Hatası: ${response.status} ${response.statusText}`);
          }

          if (response.ok) {
            const data = await response.json() as Record<string, any>;
            const raw = Array.isArray(data) ? data : (data.products || data.data || []);

            categoryProducts = raw.map((p: any, idx: number) => {
              const sku = p.StokKodu || p.stokKodu || p.STOK_KODU || p.Kod || p.KOD ||
                          p.UrunKodu || p.urunKodu || p.URUN_KODU || p.ProductCode ||
                          p.sku || p.SKU || p.id || p.ID || p.stockCode || p.code ||
                          `unknown-${category}-${idx}`;

              const title = p.StokAdi || p.stokAdi || p.STOK_ADI || p.UrunAdi || p.urunAdi ||
                            p.URUN_ADI || p.Ad || p.AD || p.Isim || p.isim || p.ISIM ||
                            p.name || p.Name || p.NAME || p.title || p.Title ||
                            p.Aciklama || p.aciklama || p.Description || "Untitled";

              const brand = p.Marka || p.marka || p.MARKA || p.Brand || p.brand || p.BRAND ||
                            p.Firma || p.firma || p.FIRMA || p.Manufacturer || p.manufacturer || "";

              const price = parseFloat(
                p.Fiyat || p.fiyat || p.FIYAT || p.BirimFiyat || p.birimFiyat ||
                p.SatisFiyati || p.satisFiyati || p.SATIS_FIYATI || p.ListeFiyat ||
                p.price || p.Price || p.PRICE || p.UnitPrice || "0"
              );

              const stock = parseInt(
                p.StokAdet || p.stokAdet || p.STOK_ADET || p.StokMiktar || p.stokMiktar ||
                p.Miktar || p.miktar || p.MIKTAR || p.Adet || p.adet || p.ADET ||
                p.stock || p.Stock || p.STOCK || p.Quantity || p.quantity || "0"
              );

              return {
                supplierSku: String(sku),
                title: String(title),
                brand: brand || "",
                category,
                price: isNaN(price) ? 0 : price,
                stock: isNaN(stock) ? 0 : stock,
                rawApiData: p,
              };
            });
          }
        }
      }

      await db.delete(productsCache).where(eq(productsCache.category, category));
      
      if (categoryProducts.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < categoryProducts.length; i += batchSize) {
          const batch = categoryProducts.slice(i, i + batchSize);
          await db.insert(productsCache).values(
            batch.map((p: any, idx) => ({
              supplierSku: String(p.supplierSku || `batch-${i}-${idx}`),
              category: String(p.category),
              title: String(p.title || "Untitled"),
              brand: p.brand || null,
              price: Math.round((p.price || 0) * 100),
              stock: parseInt(String(p.stock || 0)),
              metafields: p.rawApiData || {},
              updatedAt: new Date(),
            }))
          ).onConflictDoNothing();
        }
      }

      const duration = Date.now() - startTime;
      await db.update(cacheMetadata)
        .set({ 
          status: "idle", 
          lastFetchAt: new Date(), 
          productCount: categoryProducts.length,
          fetchDurationMs: duration,
          errorMessage: null,
          updatedAt: new Date() 
        })
        .where(eq(cacheMetadata.category, category));

      freshProducts.push(...categoryProducts);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || "Bilinmeyen hata";

      if (errorMessage.startsWith("RATE_LIMIT:")) {
        const parts = errorMessage.split(":");
        const waitSeconds = parseInt(parts[1]) || 60;
        const message = parts.slice(2).join(":") || `${waitSeconds} saniye bekleyin`;

        rateLimitError = {
          waitSeconds,
          message,
          category,
        };

        await db.update(cacheMetadata)
          .set({
            status: "rate_limited",
            fetchDurationMs: duration,
            errorMessage: message,
            updatedAt: new Date()
          })
          .where(eq(cacheMetadata.category, category));

        fetchErrors.push(`[${category}] Rate limit: ${message}`);
      } else {
        await db.update(cacheMetadata)
          .set({ status: "error", fetchDurationMs: duration, errorMessage: errorMessage, updatedAt: new Date() })
          .where(eq(cacheMetadata.category, category));

        fetchErrors.push(`[${category}] ${errorMessage}`);
      }

      const cached = await db.select().from(productsCache).where(eq(productsCache.category, category));
      freshProducts.push(...cached.map(p => ({
        supplierSku: String(p.supplierSku || "unknown"),
        title: String(p.title || "Untitled"),
        brand: p.brand || "",
        category: String(p.category || category),
        price: (p.price || 0) / 100,
        stock: p.stock || 0,
      })));
    }
  }

  return {
    products: freshProducts.slice(0, limit),
    fromCache: false,
    lastFetchAt: new Date(),
    rateLimitError,
    errors: fetchErrors,
  };
}

export const syncRouter = router({
  apiTestLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const logs = await db
        .select()
        .from(apiTestLogs)
        .orderBy(desc(apiTestLogs.createdAt))
        .limit(input.limit);
      return { logs };
    }),

  cacheStatus: protectedProcedure.query(async () => {
    const metadata = await db.select().from(cacheMetadata);
    const totalProducts = await db.select({ count: sqlFn<number>`count(*)` }).from(productsCache);

    const rateLimitedCategory = metadata.find(m => m.status === "rate_limited");

    return {
      categories: metadata.map(m => ({
        category: m.category,
        lastFetchAt: m.lastFetchAt,
        productCount: m.productCount || 0,
        status: m.status || "idle",
        isStale: !m.lastFetchAt || (Date.now() - new Date(m.lastFetchAt).getTime()) / (1000 * 60 * 60) > (m.refreshIntervalHours || 6),
        refreshIntervalHours: m.refreshIntervalHours || 6,
        errorMessage: m.errorMessage || null,
      })),
      totalProducts: Number(totalProducts[0]?.count || 0),
      rateLimitInfo: rateLimitedCategory ? {
        category: rateLimitedCategory.category,
        message: rateLimitedCategory.errorMessage || "Rate limit aktif",
        updatedAt: rateLimitedCategory.updatedAt,
      } : null,
    };
  }),

  refreshCache: protectedProcedure
    .input(z.object({
      categories: z.array(z.enum(["tire", "rim", "battery"])).default(["tire", "rim", "battery"]),
    }))
    .mutation(async ({ input }) => {
      const result = await getCachedProducts(input.categories, 100000, true);

      if (result.rateLimitError) {
        return {
          success: false,
          productCount: result.products.length,
          lastFetchAt: result.lastFetchAt,
          rateLimitError: result.rateLimitError,
          errors: result.errors,
          message: result.rateLimitError.message,
        };
      }

      return {
        success: result.errors.length === 0,
        productCount: result.products.length,
        lastFetchAt: result.lastFetchAt,
        errors: result.errors,
        message: result.errors.length > 0
          ? `${result.products.length} ürün yüklendi, ${result.errors.length} hata`
          : `${result.products.length} ürün başarıyla yüklendi`,
      };
    }),

  preview: protectedProcedure
    .input(
      z.object({
        categories: z.array(z.enum(["tire", "rim", "battery"])).default(["tire", "rim", "battery"]),
        productLimit: z.number().min(1).max(100).default(5),
        forceRefresh: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const steps: SyncStep[] = [];
      const products: ProductPreview[] = [];
      const errors: string[] = [];

      const step1Start = Date.now();
      const step1: SyncStep = { id: "1", name: "Veritabanından Yükleme", status: "running" };
      steps.push(step1);

      let supplierProductsData: any[] = [];
      
      try {
        supplierProductsData = await db
          .select()
          .from(supplierProducts)
          .where(
            inArray(supplierProducts.category, input.categories)
          )
          .orderBy(desc(supplierProducts.updatedAt))
          .limit(input.productLimit);

        step1.status = "completed";
        step1.duration = Date.now() - step1Start;
        step1.message = `${supplierProductsData.length} ürün veritabanından yüklendi`;
        step1.data = { productCount: supplierProductsData.length, fromCache: true };
      } catch (error: any) {
        step1.status = "error";
        step1.message = error.message;
        step1.duration = Date.now() - step1Start;
        errors.push(`DB yükleme hatası: ${error.message}`);
      }

      const step2Start = Date.now();
      const step2: SyncStep = { id: "2", name: "Veri Hazırlığı", status: "running" };
      steps.push(step2);

      let parsedCount = 0;
      for (const product of supplierProductsData) {
        try {
          parsedCount++;
          products.push({
            supplierSku: product.supplierSku,
            title: product.title,
            brand: product.brand || "",
            category: product.category,
            price: (product.currentPrice || 0) / 100,
            stock: product.currentStock || 0,
            status: product.validationStatus === "valid" || product.validationStatus === "published" ? "success" : "error",
            error: product.validationErrors ? JSON.stringify(product.validationErrors) : undefined,
            calculatedPrice: undefined 
          });
        } catch (error: any) {
          products.push({
            supplierSku: product.supplierSku,
            title: product.title,
            brand: product.brand || "Bilinmiyor",
            category: product.category,
            price: (product.currentPrice || 0) / 100,
            stock: product.currentStock || 0,
            status: "error",
            error: `Veri hatası: ${error.message}`,
          });
        }
      }

      step2.status = parsedCount > 0 ? "completed" : "error";
      step2.duration = Date.now() - step2Start;
      step2.message = `${parsedCount}/${supplierProductsData.length} ürün hazırlandı`;

      const step3Start = Date.now();
      const step3: SyncStep = { id: "3", name: "Fiyat Hesaplama", status: "running" };
      steps.push(step3);

      const pricingService = new PricingRulesService();
      let rulesApplied = 0;

      for (const product of products) {
        if (product.status !== "error") {
          try {
            const pricingResult = await pricingService.applyPricing(
              product.price,
              product.category as "tire" | "rim" | "battery",
              product.brand
            );
            product.calculatedPrice = pricingResult.finalPrice;
            if (pricingResult.appliedRuleId) {
              rulesApplied++;
            }
          } catch {
            const margin = product.category === "tire" ? 1.25 :
                          product.category === "rim" ? 1.30 : 1.20;
            product.calculatedPrice = Math.round(product.price * margin * 100) / 100;
          }
        }
      }

      step3.status = "completed";
      step3.duration = Date.now() - step3Start;
      step3.message = rulesApplied > 0
        ? `${rulesApplied} ürüne kural uygulandı`
        : `Fiyatlar hesaplandı`;

      const step4Start = Date.now();
      const step4: SyncStep = { id: "4", name: "Shopify Bağlantısı", status: "running" };
      steps.push(step4);

      const shopifyConfigured = !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);

      if (shopifyConfigured) {
        step4.status = "completed";
        step4.message = "Bağlantı hazır";
      } else {
        step4.status = "error";
        step4.message = "Ayarlar eksik";
        errors.push("Shopify env değişkenleri ayarlanmamış");
      }
      step4.duration = Date.now() - step4Start;

      return {
        success: errors.length === 0,
        sessionId: crypto.randomUUID(),
        steps,
        products,
        errors,
        fromCache: true,
        rateLimitError: undefined,
        summary: {
          total: supplierProductsData.length,
          success: products.filter(p => p.status === "success").length,
          errors: products.filter(p => p.status === "error").length,
          skipped: products.filter(p => p.status === "skipped").length,
        },
      };
    }),

  start: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["full", "incremental"]).default("incremental"),
        categories: z.array(z.enum(["tire", "rim", "battery"])).optional(),
        dryRun: z.boolean().default(false),
        testMode: z.boolean().default(true),
        productLimit: z.number().min(1).max(500).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const effectiveLimit = input.testMode ? (input.productLimit || 5) : (input.productLimit || 50);

      const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      const locationId = process.env.SHOPIFY_LOCATION_ID;

      if (!shopDomain || !accessToken || !locationId) {
        return {
          success: false,
          sessionId: null,
          message: "Shopify yapılandırması eksik. SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN ve SHOPIFY_LOCATION_ID gerekli.",
          config: input,
        };
      }

      try {
        let query = db.select().from(supplierProducts);
        
        query = query.where(
          inArray(supplierProducts.validationStatus, ["valid", "needs_update", "published"])
        ) as typeof query;

        if (input.categories && input.categories.length > 0) {
          query = query.where(inArray(supplierProducts.category, input.categories)) as typeof query;
        }

        const productsToSync = await query
          .orderBy(desc(supplierProducts.updatedAt))
          .limit(effectiveLimit);

        if (productsToSync.length === 0) {
           return {
            success: true,
            sessionId: null,
            message: "Senkronize edilecek ürün bulunamadı (Veritabanında 'valid' ürün yok).",
            config: input,
            result: { totalProducts: 0, created: 0, updated: 0, failed: 0, errors: [] },
          };
        }

        const sessionId = crypto.randomUUID();
        await db.insert(syncSessions).values({
          id: sessionId,
          mode: input.mode,
          status: "running",
          startedAt: new Date(),
          stats: { 
            totalProducts: productsToSync.length,
            dryRun: input.dryRun 
          },
        });

        const shopifyService = new ShopifyService({
          shopDomain,
          accessToken,
          locationId,
        });

        const pricingService = new PricingRulesService();
        
        let created = 0;
        let updated = 0;
        let failed = 0;
        const errors: string[] = [];

        const concurrency = 5;
        for (let i = 0; i < productsToSync.length; i += concurrency) {
          const batch = productsToSync.slice(i, i + concurrency);
          
          await Promise.all(batch.map(async (product) => {
            try {
              if (input.dryRun) {
                if (!product.shopifyProductId) created++;
                else updated++;
                return;
              }

              const price = (product.currentPrice || 0) / 100;
              const pricingResult = await pricingService.applyPricing(
                price,
                product.category as any,
                product.brand || undefined
              );

              let existingProduct = null;
              existingProduct = await shopifyService.getProductBySku(product.supplierSku);

              if (existingProduct) {
                const variant = existingProduct.variants[0];
                if (variant) {
                  await shopifyService.updateVariant({
                    id: variant.id,
                    price: pricingResult.finalPrice.toString(),
                  });
                  
                  if (variant.inventoryItem?.id) {
                    await shopifyService.updateInventory({
                      inventoryItemId: variant.inventoryItem.id,
                      locationId,
                      availableQuantity: product.currentStock || 0,
                    });
                  }
                }
                
                const metafieldsInput = [];
                if (product.metafields && typeof product.metafields === 'object') {
                  for (const [key, value] of Object.entries(product.metafields)) {
                    if (value === null || value === undefined || value === "") continue;
                    
                    let type = "single_line_text_field";
                    if (typeof value === "number") {
                      type = Number.isInteger(value) ? "number_integer" : "number_decimal";
                    } else if (typeof value === "boolean") {
                      type = "boolean";
                    }

                    metafieldsInput.push({
                      namespace: "custom",
                      key,
                      value: String(value),
                      type
                    });
                  }
                }

                // Corrected Shopify update call (removed metafields from updateProduct if not supported)
                updated++;
                
                await db.update(supplierProducts)
                  .set({
                    validationStatus: "published",
                    shopifyProductId: existingProduct.id,
                    shopifyVariantId: variant?.id,
                    lastSyncedAt: new Date(),
                    lastSyncedPrice: product.currentPrice,
                    lastSyncedStock: product.currentStock,
                  })
                  .where(eq(supplierProducts.id, product.id));

              } else {
                const metafieldsInput = [];
                if (product.metafields && typeof product.metafields === 'object') {
                  for (const [key, value] of Object.entries(product.metafields)) {
                    if (value === null || value === undefined || value === "") continue;
                    let type = "single_line_text_field";
                    if (typeof value === "number") {
                      type = Number.isInteger(value) ? "number_integer" : "number_decimal";
                    } else if (typeof value === "boolean") {
                      type = "boolean";
                    }
                    metafieldsInput.push({
                      namespace: "custom",
                      key,
                      value: String(value),
                      type
                    });
                  }
                }

                const newProduct = await shopifyService.createProduct({
                  title: product.title,
                  vendor: product.brand || "Tedarikçi",
                  productType: product.category,
                  status: "ACTIVE",
                  variants: [{
                    sku: product.supplierSku,
                    price: pricingResult.finalPrice.toString(),
                  }],
                  images: product.images?.map((src: string) => ({ src })) || [],
                  metafields: metafieldsInput,
                });

                if (newProduct?.variants?.[0]?.inventoryItem?.id) {
                   await shopifyService.updateInventory({
                      inventoryItemId: newProduct.variants[0].inventoryItem.id,
                      locationId,
                      availableQuantity: product.currentStock || 0,
                    });
                }

                created++;

                await db.update(supplierProducts)
                  .set({
                    validationStatus: "published",
                    shopifyProductId: newProduct.id,
                    shopifyVariantId: newProduct.variants?.[0]?.id,
                    lastSyncedAt: new Date(),
                    lastSyncedPrice: product.currentPrice,
                    lastSyncedStock: product.currentStock,
                  })
                  .where(eq(supplierProducts.id, product.id));
              }

            } catch (err: any) {
              failed++;
              errors.push(`[${product.supplierSku}] ${err.message}`);
              
              await db.insert(syncItems).values({
                sessionId,
                sku: product.supplierSku,
                action: "error",
                message: err.message,
              });
            }
          }));
        }

        await db.update(syncSessions).set({
          status: failed === 0 ? "completed" : "completed_with_errors",
          finishedAt: new Date(),
          stats: { 
            totalProducts: productsToSync.length,
            created,
            updated,
            failed,
            errors: errors.slice(0, 50) 
          },
          errorSummary: errors.length > 0 ? `${errors.length} hata oluştu` : null,
        }).where(eq(syncSessions.id, sessionId));

        return {
          success: true,
          sessionId,
          message: `Sync tamamlandı: ${created} yeni, ${updated} güncelleme, ${failed} hata.`,
          config: {
            ...input,
            effectiveProductLimit: effectiveLimit,
          },
          result: {
            totalProducts: productsToSync.length,
            created,
            updated,
            failed,
            errors: errors.slice(0, 10),
          },
        };
      } catch (error) {
        return {
          success: false,
          sessionId: null,
          message: `Sync hatası: ${(error as Error).message}`,
          config: input,
        };
      }
    }),

  status: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      try {
        const session = await db
          .select()
          .from(syncSessions)
          .where(eq(syncSessions.id, input.sessionId))
          .limit(1);

        if (!session.length) {
          return {
            sessionId: input.sessionId,
            status: "not_found",
            message: "Sync oturumu bulunamadı",
          };
        }

        const items = await db
          .select()
          .from(syncItems)
          .where(eq(syncItems.sessionId, input.sessionId));

        const sessionData = session[0]!;
        const stats = (sessionData.stats as Record<string, number>) || {};

        return {
          sessionId: input.sessionId,
          status: sessionData.status,
          startedAt: sessionData.startedAt,
          finishedAt: sessionData.finishedAt,
          mode: sessionData.mode,
          stats: {
            totalProducts: stats.totalProducts || 0,
            created: stats.created || 0,
            updated: stats.updated || 0,
            failed: stats.failed || 0,
          },
          errorSummary: sessionData.errorSummary,
          items: items.map(item => ({
            sku: item.sku,
            action: item.action,
            message: item.message,
          })),
        };
      } catch (error) {
        return {
          sessionId: input.sessionId,
          status: "error",
          message: `Durum sorgusu hatası: ${(error as Error).message}`,
        };
      }
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const sessions = await db
          .select()
          .from(syncSessions)
          .orderBy(desc(syncSessions.startedAt))
          .limit(input.limit)
          .offset(input.offset);

        const totalResult = await db
          .select({ count: sqlFn<number>`count(*)` })
          .from(syncSessions);

        const total = Number(totalResult[0]?.count || 0);

        return {
          sessions: sessions.map(s => ({
            id: s.id,
            status: s.status,
            mode: s.mode,
            startedAt: s.startedAt,
            finishedAt: s.finishedAt,
            stats: s.stats,
            errorSummary: s.errorSummary,
          })),
          total,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        return {
          sessions: [],
          total: 0,
          message: `Geçmiş sorgusu hatası: ${(error as Error).message}`,
        };
      }
    }),

  cancel: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      return {
        success: true,
        sessionId: input.sessionId,
        message: "Sync cancelled (orchestrator integration pending)",
      };
    }),

  reprocessAll: protectedProcedure
    .input(z.void())
    .mutation(async () => {
      try {
        const titleParser = new TitleParserService();
        const pricingService = new PricingRulesService();
        
        let query = db.select().from(supplierProducts);
        if (input?.category) {
          query = query.where(eq(supplierProducts.category, input.category)) as typeof query;
        }

        const allProducts = await query;
        let successCount = 0;
        let errorCount = 0;

        const batchSize = 50;
        for (let i = 0; i < allProducts.length; i += batchSize) {
          const batch = allProducts.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (product) => {
            try {
              const category = (product.category || titleParser.detectCategory(product.title || "")) as "tire" | "rim" | "battery";
              const parsingResult = titleParser.parseDetailed(category, product.title || "");
              
              const cost = (product.currentPrice || 0) / 100;
              await pricingService.applyPricing(cost, category, product.brand || undefined);

              await db.update(supplierProducts)
                .set({
                  category,
                  model: parsingResult.data?.model || null,
                  brand: product.brand || parsingResult.data?.brand || null,
                  metafields: parsingResult.data || {},
                  validationStatus: parsingResult.success ? "valid" : "invalid",
                  validationErrors: parsingResult.success ? null : [{ field: "all", message: "Parsing basarisiz" }],
                  updatedAt: new Date(),
                })
                .where(eq(supplierProducts.id, product.id));
              
              successCount++;
            } catch (err) {
              errorCount++;
            }
          }));
        }

        return {
          success: true,
          message: `${successCount} urun yeniden islendi, ${errorCount} hata.`,
          total: allProducts.length,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Yeniden isleme hatasi: ${error.message}`,
        };
      }
    }),

  productDetail: protectedProcedure
    .input(z.object({
      supplierSku: z.string(),
      category: z.enum(["tire", "rim", "battery"]).optional(),
    }))
    .query(async ({ input }) => {
      const { supplierSku } = input;

      const cachedProduct = await db
        .select()
        .from(supplierProducts)
        .where(eq(supplierProducts.supplierSku, supplierSku))
        .limit(1);

      if (!cachedProduct.length) {
        return {
          success: false,
          error: "Urun veritabaninda bulunamadi",
          supplierSku,
        };
      }

      const product = cachedProduct[0]!;
      const category = (input.category || product.category || "tire") as "tire" | "rim" | "battery";

      const titleParser = new TitleParserService();
      const parsingResult = titleParser.parseDetailed(category, product.title || "");

      let parsedData: Record<string, any> = {};
      if (parsingResult.data) {
        parsedData = { ...parsingResult.data };
      }
      parsedData.brand = product.brand;

      const metafields: any[] = [];
      if (parsingResult.data) {
          for (const [key, value] of Object.entries(parsingResult.data)) {
              metafields.push({
                  key,
                  namespace: "custom",
                  value,
                  type: typeof value === "number" ? "number_integer" : "single_line_text_field",
                  status: "valid"
              });
          }
      }

      const pricingService = new PricingRulesService();
      let pricing: any;

      try {
        const price = (product.currentPrice || 0) / 100;
        const pricingResult = await pricingService.applyPricing(
          price,
          category,
          product.brand || undefined
        );

        pricing = {
          supplierPrice: price,
          calculatedPrice: pricingResult.finalPrice,
          margin: pricingResult.finalPrice - price,
          marginPercent: price > 0 ? ((pricingResult.finalPrice - price) / price) * 100 : 0,
          rule: pricingResult.appliedRuleId ? `Rule ID: ${pricingResult.appliedRuleId}` : "Varsayilan margin",
        };
      } catch (e) {
        const price = (product.currentPrice || 0) / 100;
        const margin = category === "tire" ? 1.25 : category === "rim" ? 1.30 : 1.20;
        pricing = {
          supplierPrice: price,
          calculatedPrice: Math.round(price * margin * 100) / 100,
          margin: Math.round(price * (margin - 1) * 100) / 100,
          marginPercent: (margin - 1) * 100,
          rule: "Varsayilan margin (hata nedeniyle)",
        };
      }

      let shopifyProduct: any = null;
      let shopifyChanges: any[] = [];
      let shopifyLookupError: string | undefined;

      try {
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const locationId = process.env.SHOPIFY_LOCATION_ID;

        if (shopDomain && accessToken && locationId) {
          const shopifyService = new ShopifyService({
            shopDomain,
            accessToken,
            locationId,
          });

          const shopifyData = await shopifyService.getProductBySku(supplierSku);

          if (shopifyData) {
            const variant = shopifyData.variants[0];
            const currentPrice = variant ? parseFloat(variant.price) : 0;
            const currentInventory = variant?.inventoryQuantity ?? 0;

            shopifyProduct = {
              id: shopifyData.id,
              title: shopifyData.title,
              price: currentPrice,
              inventory: currentInventory,
              status: shopifyData.status,
            };

            const newPrice = pricing?.calculatedPrice ?? 0;
            const newStock = product.currentStock ?? 0;

            if (Math.abs(currentPrice - newPrice) > 0.01) {
              shopifyChanges.push({
                field: "price",
                oldValue: `${currentPrice.toFixed(2)} ₺`,
                newValue: `${newPrice.toFixed(2)} ₺`,
                changeType: "update",
              });
            }

            if (currentInventory !== newStock) {
              shopifyChanges.push({
                field: "inventory",
                oldValue: `${currentInventory} adet`,
                newValue: `${newStock} adet`,
                changeType: "update",
              });
            }
          }
        }
      } catch (e) {
        shopifyLookupError = (e as Error).message;
      }

      return {
        success: true,
        supplierSku,
        title: product.title,
        category,
        rawData: {
          supplierSku: product.supplierSku,
          title: product.title,
          brand: product.brand,
          category: product.category,
          price: (product.currentPrice || 0) / 100,
          stock: product.currentStock,
          updatedAt: product.updatedAt,
        },
        parsingResult: {
          success: parsingResult.success,
          rawTitle: parsingResult.rawTitle,
          fields: parsingResult.fields,
          data: parsingResult.data,
        },
        parsedData: {
          ...parsedData,
          parseSuccess: parsingResult.success,
        },
        metafields,
        pricing,
        shopifyProduct,
        shopifyChanges,
        shopifyLookupError,
        summary: {
          metafieldValid: metafields.length,
          metafieldWarning: 0,
          metafieldError: 0,
          parseSuccess: parsingResult.success,
          parseFieldsSuccess: parsingResult.fields.filter(f => f.success).length,
          parseFieldsTotal: parsingResult.fields.length,
          hasShopifyProduct: !!shopifyProduct,
          shopifyChangesCount: shopifyChanges.length,
          isNewProduct: !shopifyProduct,
        },
      };
    }),

  bulkSendToShopify: protectedProcedure
    .input(z.object({
      productIds: z.array(z.number()).optional(),
      status: z.enum(["valid", "needs_update"]).optional(),
      limit: z.number().default(50),
    }))
    .mutation(async ({ input }) => {
      try {
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const locationId = process.env.SHOPIFY_LOCATION_ID;

        if (!shopDomain || !accessToken || !locationId) {
          return {
            success: false,
            message: "Shopify yapılandırması eksik",
            synced: 0,
            failed: 0,
          };
        }

        let products: any[];

        if (input.productIds && input.productIds.length > 0) {
          products = await db
            .select()
            .from(supplierProducts)
            .where(inArray(supplierProducts.id, input.productIds));
        } else if (input.status) {
          products = await db
            .select()
            .from(supplierProducts)
            .where(eq(supplierProducts.validationStatus, input.status))
            .limit(input.limit);
        } else {
          products = await db
            .select()
            .from(supplierProducts)
            .where(eq(supplierProducts.validationStatus, "valid"))
            .limit(input.limit);
        }

        if (products.length === 0) {
          return {
            success: true,
            message: "Gönderilecek ürün bulunamadı",
            synced: 0,
            failed: 0,
          };
        }

        const shopifyService = new ShopifyService({ shopDomain, accessToken, locationId });

        let synced = 0;
        let failed = 0;
        const errors: string[] = [];

        const sessionId = crypto.randomUUID();
        await db.insert(syncSessions).values({
          id: sessionId,
          mode: "bulk",
          status: "running",
          stats: { productIds: products.map(p => p.id) },
        });

        for (const product of products) {
          try {
            const supplierProduct = {
              supplierSku: product.supplierSku,
              title: product.title,
              brand: product.brand || "",
              model: product.model || "",
              category: product.category as "tire" | "rim" | "battery",
              price: (product.currentPrice || 0) / 100,
              stock: product.currentStock || 0,
              barcode: product.barcode || undefined,
              description: product.description || undefined,
              images: product.images || [],
              metafields: product.metafields || {},
            };

            const existingProduct = await shopifyService.getProductBySku(product.supplierSku);

            if (existingProduct) {
              const variant = existingProduct.variants[0];
              if (variant) {
                const pricingService = new PricingRulesService();
                const pricingResult = await pricingService.applyPricing(
                  supplierProduct.price,
                  supplierProduct.category,
                  supplierProduct.brand
                );

                await shopifyService.updateVariant({
                  id: variant.id,
                  price: pricingResult.finalPrice.toString(),
                });

                if (variant.inventoryItem?.id) {
                  await shopifyService.updateInventory({
                    inventoryItemId: variant.inventoryItem.id,
                    locationId,
                    availableQuantity: supplierProduct.stock,
                  });
                }

                await db.update(supplierProducts)
                  .set({
                    validationStatus: "published",
                    shopifyProductId: existingProduct.id,
                    shopifyVariantId: variant.id,
                    shopifyInventoryItemId: variant.inventoryItem?.id || null,
                    lastSyncedPrice: product.currentPrice,
                    lastSyncedStock: product.currentStock,
                    lastSyncedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(supplierProducts.id, product.id));
              }
            } else {
              const pricingService = new PricingRulesService();
              const pricingResult = await pricingService.applyPricing(
                supplierProduct.price,
                supplierProduct.category,
                supplierProduct.brand
              );

              const createdProduct = await shopifyService.createProduct({
                title: supplierProduct.title,
                descriptionHtml: supplierProduct.description,
                vendor: supplierProduct.brand,
                productType: supplierProduct.category,
                status: "ACTIVE",
                variants: [{
                  sku: supplierProduct.supplierSku,
                  price: pricingResult.finalPrice.toString(),
                }],
                images: supplierProduct.images?.map((src: string) => ({ src })),
              });

              const createdVariant = createdProduct.variants?.[0];

              await db.update(supplierProducts)
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
            }

            synced++;
          } catch (error: any) {
            failed++;
            errors.push(`${product.supplierSku}: ${error.message}`);
          }
        }

        await db.update(syncSessions)
          .set({
            status: failed === 0 ? "completed" : "completed_with_errors",
            finishedAt: new Date(),
            stats: { synced, failed, errors: errors.slice(0, 10) },
          })
          .where(eq(syncSessions.id, sessionId));

        return {
          success: failed === 0,
          message: `${synced} ürün senkronize edildi, ${failed} başarısız`,
          synced,
          failed,
          errors: errors.slice(0, 10),
          sessionId,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Toplu sync hatası: ${error.message}`,
          synced: 0,
          failed: 0,
        };
      }
    }),
});
