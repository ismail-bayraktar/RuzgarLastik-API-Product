import { protectedProcedure, router } from "../index";
import { db, eq, desc, sqlFn, inArray } from "@my-better-t-app/db";
import { apiTestLogs, productsCache, cacheMetadata, syncSessions, syncItems, productMap, supplierProducts } from "@my-better-t-app/db/schema";
import { z } from "zod";
import { SyncOrchestrator, type SyncConfig } from "../../../../apps/web/src/services/syncOrchestrator";
import { SupplierService } from "../../../../apps/web/src/services/supplierService";
import { ShopifyService } from "../../../../apps/web/src/services/shopifyService";
import { PricingRulesService } from "../../../../apps/web/src/services/pricingRulesService";
import { TitleParserService } from "../../../../apps/web/src/services/titleParserService";
import {
  getProductMetafields,
  createMetafieldObject,
  type MetafieldDefinition
} from "../../../../apps/web/src/services/metafieldUtils";
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

          // Handle rate limiting (429 Too Many Requests)
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitSeconds = retryAfter ? parseInt(retryAfter) : 60; // Default 60 seconds

            await db.update(cacheMetadata)
              .set({
                status: "rate_limited",
                errorMessage: `Rate limit: ${waitSeconds} saniye bekleyin`,
                updatedAt: new Date()
              })
              .where(eq(cacheMetadata.category, category));

            throw new Error(`RATE_LIMIT:${waitSeconds}:Tedarikçi API rate limit. ${waitSeconds} saniye sonra tekrar deneyin.`);
          }

          // Handle other HTTP errors
          if (!response.ok) {
            throw new Error(`API Hatası: ${response.status} ${response.statusText}`);
          }

          if (response.ok) {
            const data = await response.json() as Record<string, any>;
            const raw = Array.isArray(data) ? data : (data.products || data.data || []);

            // Debug: Log first product structure to understand API response
            if (raw.length > 0) {
              console.log(`[SYNC] API Response sample for ${category}:`, JSON.stringify(raw[0], null, 2).slice(0, 1000));
              console.log(`[SYNC] API Response keys for ${category}:`, Object.keys(raw[0]));
            }

            // Enhanced field mapping to support various Turkish and English field names
            categoryProducts = raw.map((p: any, idx: number) => {
              // SKU field mapping - check many common variations
              const sku = p.StokKodu || p.stokKodu || p.STOK_KODU || p.Kod || p.KOD ||
                          p.UrunKodu || p.urunKodu || p.URUN_KODU || p.ProductCode ||
                          p.sku || p.SKU || p.id || p.ID || p.stockCode || p.code ||
                          `unknown-${category}-${idx}`;

              // Title field mapping
              const title = p.StokAdi || p.stokAdi || p.STOK_ADI || p.UrunAdi || p.urunAdi ||
                            p.URUN_ADI || p.Ad || p.AD || p.Isim || p.isim || p.ISIM ||
                            p.name || p.Name || p.NAME || p.title || p.Title ||
                            p.Aciklama || p.aciklama || p.Description || "Untitled";

              // Brand field mapping
              const brand = p.Marka || p.marka || p.MARKA || p.Brand || p.brand || p.BRAND ||
                            p.Firma || p.firma || p.FIRMA || p.Manufacturer || p.manufacturer || "";

              // Price field mapping
              const price = parseFloat(
                p.Fiyat || p.fiyat || p.FIYAT || p.BirimFiyat || p.birimFiyat ||
                p.SatisFiyati || p.satisFiyati || p.SATIS_FIYATI || p.ListeFiyat ||
                p.price || p.Price || p.PRICE || p.UnitPrice || "0"
              );

              // Stock field mapping
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
                rawApiData: p, // Store raw API response for debugging
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
              metafields: p.rawApiData || {}, // Store raw API data for debugging
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

      // Check if it's a rate limit error
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

      // Fall back to cached products
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

    // Check if any category is rate limited
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

      // Return rate limit info if present
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
      const step1: SyncStep = { id: "1", name: "Ürün Verisi Yükleme", status: "running" };
      steps.push(step1);

      let supplierProducts: any[] = [];
      let fromCache = false;
      let rateLimitError: CachedProductsResult["rateLimitError"] = undefined;

      try {
        const result = await getCachedProducts(input.categories, input.productLimit, input.forceRefresh);
        supplierProducts = result.products;
        fromCache = result.fromCache;
        rateLimitError = result.rateLimitError;

        // Add any fetch errors to the errors list
        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }

        // Handle rate limit in step status
        if (result.rateLimitError) {
          step1.status = "error";
          step1.duration = Date.now() - step1Start;
          step1.message = `Rate limit: ${result.rateLimitError.message}`;
          step1.data = {
            productCount: supplierProducts.length,
            fromCache: true, // Falling back to cache
            rateLimitError: result.rateLimitError,
          };
        } else {
          step1.status = "completed";
          step1.duration = Date.now() - step1Start;
          step1.message = fromCache
            ? `${supplierProducts.length} ürün cache'den yüklendi`
            : `${supplierProducts.length} ürün API'den çekildi ve cache'lendi`;
          step1.data = { productCount: supplierProducts.length, fromCache };
        }
      } catch (error: any) {
        step1.status = "error";
        step1.message = error.message;
        step1.duration = Date.now() - step1Start;
        errors.push(`Ürün yükleme hatası: ${error.message}`);
      }

      const step2Start = Date.now();
      const step2: SyncStep = { id: "2", name: "Ürün Verisi Ayrıştırma", status: "running" };
      steps.push(step2);

      let parsedCount = 0;
      for (const product of supplierProducts) {
        try {
          parsedCount++;
          products.push({
            supplierSku: product.supplierSku,
            title: product.title,
            brand: product.brand,
            category: product.category,
            price: product.price,
            stock: product.stock,
            status: "pending",
          });
        } catch (error: any) {
          products.push({
            supplierSku: product.supplierSku,
            title: product.title,
            brand: product.brand || "Bilinmiyor",
            category: product.category,
            price: product.price,
            stock: product.stock || 0,
            status: "error",
            error: `Parse hatası: ${error.message}`,
          });
        }
      }

      step2.status = parsedCount > 0 ? "completed" : "error";
      step2.duration = Date.now() - step2Start;
      step2.message = `${parsedCount}/${supplierProducts.length} ürün ayrıştırıldı`;

      const step3Start = Date.now();
      const step3: SyncStep = { id: "3", name: "Fiyat Kuralları Uygulama", status: "running" };
      steps.push(step3);

      // Use PricingRulesService for pricing calculations
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
            // Fallback to default margins if pricing service fails
            const margin = product.category === "tire" ? 1.25 :
                          product.category === "rim" ? 1.30 : 1.20;
            product.calculatedPrice = Math.round(product.price * margin * 100) / 100;
          }
        }
      }

      step3.status = "completed";
      step3.duration = Date.now() - step3Start;
      step3.message = rulesApplied > 0
        ? `${rulesApplied} ürüne DB kuralı uygulandı`
        : `Varsayılan fiyatlar hesaplandı`;

      const step4Start = Date.now();
      const step4: SyncStep = { id: "4", name: "Shopify Hazırlık", status: "running" };
      steps.push(step4);

      const shopifyConfigured = !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);

      if (shopifyConfigured) {
        step4.status = "completed";
        step4.message = "Shopify bağlantısı hazır";
      } else {
        step4.status = "error";
        step4.message = "Shopify yapılandırması eksik";
        errors.push("Shopify env değişkenleri ayarlanmamış");
      }
      step4.duration = Date.now() - step4Start;

      for (const product of products) {
        if (product.status === "pending") {
          product.status = shopifyConfigured ? "success" : "skipped";
        }
      }

      return {
        success: errors.length === 0 && !rateLimitError,
        sessionId: crypto.randomUUID(),
        steps,
        products,
        errors,
        fromCache,
        rateLimitError, // Include rate limit info for UI
        summary: {
          total: supplierProducts.length,
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
      const effectiveLimit = input.testMode ? (input.productLimit || 5) : undefined;

      // Check Shopify configuration
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
        const useMock = process.env.USE_MOCK_SUPPLIER === "true";

        const supplierService = new SupplierService({ useMock });
        const shopifyService = new ShopifyService({
          shopDomain,
          accessToken,
          locationId,
        });

        const orchestrator = new SyncOrchestrator({
          supplierService,
          shopifyService,
        });

        const syncConfig: SyncConfig = {
          mode: input.mode,
          categories: input.categories,
          dryRun: input.dryRun,
          batchSize: effectiveLimit,
        };

        const result = await orchestrator.startSync(syncConfig);

        return {
          success: result.status !== "failed",
          sessionId: result.sessionId,
          message: result.status === "completed"
            ? `Sync tamamlandı: ${result.created} oluşturuldu, ${result.updated} güncellendi, ${result.failed} başarısız`
            : `Sync durumu: ${result.status}`,
          config: {
            ...input,
            effectiveProductLimit: effectiveLimit,
          },
          result: {
            totalProducts: result.totalProducts,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
            errors: result.errors.slice(0, 10), // First 10 errors
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

  productDetail: protectedProcedure
    .input(z.object({
      supplierSku: z.string(),
      category: z.enum(["tire", "rim", "battery"]).optional(),
    }))
    .query(async ({ input }) => {
      const { supplierSku } = input;

      // 1. Get raw product data from cache
      const cachedProduct = await db
        .select()
        .from(productsCache)
        .where(eq(productsCache.supplierSku, supplierSku))
        .limit(1);

      if (!cachedProduct.length) {
        return {
          success: false,
          error: "Urun cache'de bulunamadi",
          supplierSku,
        };
      }

      const product = cachedProduct[0]!;
      const category = (input.category || product.category || "tire") as "tire" | "rim" | "battery";

      // 2. Parse title with DETAILED results
      const titleParser = new TitleParserService();
      const parsingResult = titleParser.parseDetailed(category, product.title || "");

      // Build parsedData from detailed result for backward compatibility
      let parsedData: Record<string, any> = {};
      if (parsingResult.data) {
        parsedData = { ...parsingResult.data };
      }
      parsedData.brand = product.brand;

      // 3. Generate metafields with validation
      type MetafieldStatus = "valid" | "warning" | "error";
      const metafields: Array<{
        key: string;
        namespace: string;
        value: any;
        type: string;
        status: MetafieldStatus;
        message?: string;
      }> = [];

      // Map parsed data to metafield definitions
      const metafieldMapping: Record<string, { key: MetafieldKey; value: any }> = {
        brand: { key: "marka", value: product.brand },
        category: { key: "urun_tipi", value: category },
        size: { key: "ebat", value: product.title },
        width: { key: "genislik", value: parsedData.width },
        ratio: { key: "profil", value: parsedData.aspectRatio || parsedData.ratio },
        diameter: { key: "cap", value: parsedData.rimDiameter || parsedData.diameter },
        loadIndex: { key: "yuk_indeksi", value: parsedData.loadIndex },
        speedIndex: { key: "hiz_indeksi", value: parsedData.speedIndex },
        season: { key: "sezon", value: parsedData.season },
      };

      for (const [_, mapping] of Object.entries(metafieldMapping)) {
        const definition = METAFIELD_DEFINITIONS[mapping.key];
        if (!definition) continue;

        let status: MetafieldStatus = "valid";
        let message: string | undefined;
        let coercedValue: string | null = null;

        try {
          if (mapping.value !== undefined && mapping.value !== null && mapping.value !== "") {
            coercedValue = validateMetafield(mapping.key, mapping.value);
          } else if (definition.required) {
            status = "error";
            message = "Zorunlu alan eksik";
          } else {
            status = "warning";
            message = "Deger bulunamadi";
          }
        } catch (e) {
          status = "error";
          message = (e as Error).message;
        }

        metafields.push({
          key: mapping.key,
          namespace: "custom",
          value: coercedValue ?? mapping.value,
          type: MetafieldType[definition.type],
          status,
          message,
        });
      }

      // 4. Calculate pricing
      const pricingService = new PricingRulesService();
      let pricing: {
        supplierPrice: number;
        calculatedPrice: number;
        margin: number;
        marginPercent: number;
        rule?: string;
        compareAtPrice?: number;
      } | undefined;

      try {
        const price = (product.price || 0) / 100; // Convert from cents
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
        console.error("Pricing calculation error:", e);
        const price = (product.price || 0) / 100;
        const margin = category === "tire" ? 1.25 : category === "rim" ? 1.30 : 1.20;
        pricing = {
          supplierPrice: price,
          calculatedPrice: Math.round(price * margin * 100) / 100,
          margin: Math.round(price * (margin - 1) * 100) / 100,
          marginPercent: (margin - 1) * 100,
          rule: "Varsayilan margin (hata nedeniyle)",
        };
      }

      // 5. Check Shopify for existing product - REAL API LOOKUP
      let shopifyProduct: {
        id: string;
        title: string;
        price: number;
        inventory: number;
        status: string;
        metafields?: Array<{
          namespace: string;
          key: string;
          value: string;
          type: string;
        }>;
      } | null = null;

      let shopifyChanges: Array<{
        field: string;
        oldValue: any;
        newValue: any;
        changeType: "update" | "add" | "remove";
      }> = [];

      let shopifyLookupError: string | undefined;

      try {
        // Check if Shopify credentials are configured
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const locationId = process.env.SHOPIFY_LOCATION_ID;

        if (shopDomain && accessToken && locationId) {
          // First check productMap for existing mapping
          const existingMapping = await db
            .select()
            .from(productMap)
            .where(eq(productMap.sku, supplierSku))
            .limit(1);

          // Create ShopifyService instance
          const shopifyService = new ShopifyService({
            shopDomain,
            accessToken,
            locationId,
          });

          // Try to find product by SKU in Shopify
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
              metafields: shopifyData.metafields?.map(m => ({
                namespace: m.namespace,
                key: m.key,
                value: m.value,
                type: m.type,
              })),
            };

            // Calculate changes between supplier data and Shopify data
            const newPrice = pricing?.calculatedPrice ?? 0;
            const newStock = product.stock ?? 0;

            // Price change
            if (Math.abs(currentPrice - newPrice) > 0.01) {
              const priceDiff = newPrice - currentPrice;
              const priceDiffPercent = currentPrice > 0 ? (priceDiff / currentPrice) * 100 : 0;
              shopifyChanges.push({
                field: "price",
                oldValue: `${currentPrice.toFixed(2)} ₺`,
                newValue: `${newPrice.toFixed(2)} ₺ (${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} ₺, ${priceDiffPercent >= 0 ? "+" : ""}${priceDiffPercent.toFixed(1)}%)`,
                changeType: "update",
              });
            }

            // Inventory change
            if (currentInventory !== newStock) {
              const stockDiff = newStock - currentInventory;
              shopifyChanges.push({
                field: "inventory",
                oldValue: `${currentInventory} adet`,
                newValue: `${newStock} adet (${stockDiff >= 0 ? "+" : ""}${stockDiff})`,
                changeType: "update",
              });
            }

            // Title change
            if (shopifyData.title !== product.title) {
              shopifyChanges.push({
                field: "title",
                oldValue: shopifyData.title,
                newValue: product.title,
                changeType: "update",
              });
            }

            // Update productMap if needed
            if (!existingMapping.length && shopifyData.id) {
              const inventoryItemId = variant?.inventoryItem?.id;
              await db.insert(productMap).values({
                sku: supplierSku,
                category,
                shopifyId: shopifyData.id,
                inventoryItemId: inventoryItemId || null,
                lastSyncAt: new Date(),
              }).onConflictDoUpdate({
                target: productMap.sku,
                set: {
                  shopifyId: shopifyData.id,
                  inventoryItemId: inventoryItemId || null,
                  updatedAt: new Date(),
                },
              });
            }
          }
        } else {
          shopifyLookupError = "Shopify API ayarlari eksik";
        }
      } catch (e) {
        console.error("Shopify lookup error:", e);
        shopifyLookupError = (e as Error).message;
      }

      // Return complete product detail with enhanced parsing result
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
          price: (product.price || 0) / 100,
          stock: product.stock,
          cachedAt: product.updatedAt,
          // Include raw API data from metafields for debugging
          rawApiResponse: product.metafields || {},
        },
        // Enhanced parsing result with field-by-field details
        parsingResult: {
          success: parsingResult.success,
          rawTitle: parsingResult.rawTitle,
          fields: parsingResult.fields,
          data: parsingResult.data,
        },
        // Keep parsedData for backward compatibility
        parsedData: {
          ...parsedData,
          parseSuccess: parsingResult.success,
        },
        metafields,
        pricing,
        // Enhanced Shopify product with changes
        shopifyProduct,
        shopifyChanges,
        shopifyLookupError,
        // Summary stats
        summary: {
          metafieldValid: metafields.filter(m => m.status === "valid").length,
          metafieldWarning: metafields.filter(m => m.status === "warning").length,
          metafieldError: metafields.filter(m => m.status === "error").length,
          parseSuccess: parsingResult.success,
          parseFieldsSuccess: parsingResult.fields.filter(f => f.success).length,
          parseFieldsTotal: parsingResult.fields.length,
          hasShopifyProduct: !!shopifyProduct,
          shopifyChangesCount: shopifyChanges.length,
          isNewProduct: !shopifyProduct,
        },
      };
    }),

  // ==================== VALIDATION ENDPOINTS ====================

  // Tüm ürünleri validate et
  validateProducts: protectedProcedure
    .input(z.object({
      category: z.enum(["tire", "rim", "battery"]).optional(),
    }).optional())
    .mutation(async ({ input }) => {
      try {
        const stats = await validationService.validateAll(input?.category);
        return {
          success: true,
          message: `${stats.total} ürün valide edildi`,
          stats,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Validasyon hatası: ${error.message}`,
          stats: null,
        };
      }
    }),

  // Validasyon istatistiklerini al
  getValidationStats: protectedProcedure.query(async () => {
    try {
      const stats = await validationService.getValidationStats();
      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        stats: null,
      };
    }
  }),

  // Validasyon ayarlarını al
  getValidationSettings: protectedProcedure.query(async () => {
    try {
      const settings = await validationService.getSettings();
      return {
        success: true,
        settings,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        settings: null,
      };
    }
  }),

  // Validasyon ayarlarını güncelle
  updateValidationSettings: protectedProcedure
    .input(z.object({
      minPrice: z.number().optional(),
      minStock: z.number().optional(),
      requireImage: z.boolean().optional(),
      requireBrand: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await validationService.updateSettings(input);
        const newSettings = await validationService.getSettings();
        return {
          success: true,
          message: "Ayarlar güncellendi",
          settings: newSettings,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Ayar güncelleme hatası: ${error.message}`,
          settings: null,
        };
      }
    }),

  // Manuel ürün onayı
  approveProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await validationService.approveProduct(input.productId);
        return {
          success: true,
          message: "Ürün onaylandı",
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Onay hatası: ${error.message}`,
        };
      }
    }),

  // Manuel ürün reddi
  rejectProduct: protectedProcedure
    .input(z.object({
      productId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await validationService.rejectProduct(input.productId, input.reason);
        return {
          success: true,
          message: "Ürün reddedildi",
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Red hatası: ${error.message}`,
        };
      }
    }),

  // Ürünleri validasyon durumuna göre listele
  getProductsByStatus: protectedProcedure
    .input(z.object({
      status: z.enum(["raw", "valid", "invalid", "published", "needs_update", "inactive"]).optional(),
      category: z.enum(["tire", "rim", "battery"]).optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      try {
        let query = db.select().from(supplierProducts);

        // Status filtresi
        if (input.status) {
          query = query.where(eq(supplierProducts.validationStatus, input.status)) as typeof query;
        }

        // Category filtresi
        if (input.category) {
          query = query.where(eq(supplierProducts.category, input.category)) as typeof query;
        }

        // Pagination
        const products = await query
          .orderBy(desc(supplierProducts.updatedAt))
          .limit(input.limit)
          .offset(input.offset);

        // Total count
        let countQuery = db.select({ count: sqlFn<number>`count(*)` }).from(supplierProducts);
        if (input.status) {
          countQuery = countQuery.where(eq(supplierProducts.validationStatus, input.status)) as typeof countQuery;
        }
        if (input.category) {
          countQuery = countQuery.where(eq(supplierProducts.category, input.category)) as typeof countQuery;
        }
        const totalResult = await countQuery;
        const total = Number(totalResult[0]?.count || 0);

        return {
          success: true,
          products: products.map(p => ({
            id: p.id,
            supplierSku: p.supplierSku,
            generatedSku: p.generatedSku,
            title: p.title,
            brand: p.brand,
            category: p.category,
            price: (p.currentPrice || 0) / 100,
            stock: p.currentStock,
            validationStatus: p.validationStatus,
            validationErrors: p.validationErrors,
            missingFields: p.missingFields,
            shopifyProductId: p.shopifyProductId,
            images: p.images,
            updatedAt: p.updatedAt,
          })),
          total,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message,
          products: [],
          total: 0,
          limit: input.limit,
          offset: input.offset,
        };
      }
    }),

  // Toplu Shopify'a gönder
  bulkSendToShopify: protectedProcedure
    .input(z.object({
      productIds: z.array(z.number()).optional(),
      status: z.enum(["valid", "needs_update"]).optional(),
      limit: z.number().default(50),
    }))
    .mutation(async ({ input }) => {
      try {
        // Shopify config kontrolü
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

        // Ürünleri al
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

        // Her ürünü sync et (basit implementasyon)
        let synced = 0;
        let failed = 0;
        const errors: string[] = [];

        // Start a sync session
        const sessionId = crypto.randomUUID();
        await db.insert(syncSessions).values({
          id: sessionId,
          mode: "bulk",
          status: "running",
          stats: { productIds: products.map(p => p.id) },
        });

        for (const product of products) {
          try {
            // Dönüştür SupplierProduct formatına
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

            // Shopify'da mevcut mu kontrol et
            const existingProduct = await shopifyService.getProductBySku(product.supplierSku);

            if (existingProduct) {
              // Güncelle
              const variant = existingProduct.variants[0];
              if (variant) {
                // Fiyat güncelle
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

                // Stok güncelle
                if (variant.inventoryItem?.id) {
                  await shopifyService.updateInventory({
                    inventoryItemId: variant.inventoryItem.id,
                    locationId,
                    availableQuantity: supplierProduct.stock,
                  });
                }

                // DB'yi güncelle
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
              // Yeni oluştur
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
                  barcode: supplierProduct.barcode,
                }],
                images: supplierProduct.images?.map((src: string) => ({ src })),
              });

              const createdVariant = createdProduct.variants?.[0];

              // DB'yi güncelle
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

        // Session'ı güncelle
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
