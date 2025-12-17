import { protectedProcedure, router } from "../index";
import { db } from "@my-better-t-app/db";
import { apiTestLogs, productsCache, cacheMetadata } from "@my-better-t-app/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

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

async function getCachedProducts(categories: string[], limit: number, forceRefresh = false): Promise<{
  products: any[];
  fromCache: boolean;
  lastFetchAt: Date | null;
}> {
  if (!forceRefresh) {
    let allValid = true;
    for (const cat of categories) {
      const meta = await db.select().from(cacheMetadata).where(eq(cacheMetadata.category, cat)).limit(1);
      if (!meta[0]?.lastFetchAt) {
        allValid = false;
        break;
      }
      const hoursSince = (Date.now() - new Date(meta[0].lastFetchAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince > (meta[0].refreshIntervalHours || 24)) {
        allValid = false;
        break;
      }
    }

    if (allValid) {
      let products: any[] = [];
      for (const cat of categories) {
        const cached = await db.select().from(productsCache).where(eq(productsCache.category, cat));
        products = products.concat(cached.map(p => ({
          supplierSku: p.supplierSku,
          title: p.title,
          brand: p.brand || "",
          category: p.category,
          price: p.price / 100,
          stock: p.stock,
        })));
      }
      
      const oldestMeta = await db.select().from(cacheMetadata).orderBy(cacheMetadata.lastFetchAt).limit(1);
      return {
        products: products.slice(0, limit),
        fromCache: true,
        lastFetchAt: oldestMeta[0]?.lastFetchAt || null,
      };
    }
  }

  const freshProducts: any[] = [];
  const useMock = process.env.USE_MOCK_SUPPLIER === "true";

  for (const category of categories) {
    const startTime = Date.now();
    
    try {
      await db.insert(cacheMetadata).values({ category, status: "fetching" })
        .onConflictDoUpdate({ target: cacheMetadata.category, set: { status: "fetching", updatedAt: new Date() } });

      let categoryProducts: any[] = [];

      if (useMock) {
        const mockData = await import("../../../server/data/mock-products.json");
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
          if (response.ok) {
            const data = await response.json();
            const raw = Array.isArray(data) ? data : (data.products || data.data || []);
            categoryProducts = raw.map((p: any) => ({
              supplierSku: p.StokKodu || p.sku || p.id,
              title: p.StokAdi || p.name || p.title,
              brand: p.Marka || p.brand || "",
              category,
              price: parseFloat(p.Fiyat || p.price || "0"),
              stock: parseInt(p.StokAdet || p.stock || "0"),
            }));
          }
        }
      }

      await db.delete(productsCache).where(eq(productsCache.category, category));
      
      if (categoryProducts.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < categoryProducts.length; i += batchSize) {
          const batch = categoryProducts.slice(i, i + batchSize);
          await db.insert(productsCache).values(
            batch.map(p => ({
              supplierSku: p.supplierSku,
              category: p.category,
              title: p.title,
              brand: p.brand || null,
              price: Math.round(p.price * 100),
              stock: p.stock,
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
      await db.update(cacheMetadata)
        .set({ status: "error", fetchDurationMs: duration, errorMessage: error.message, updatedAt: new Date() })
        .where(eq(cacheMetadata.category, category));
      
      const cached = await db.select().from(productsCache).where(eq(productsCache.category, category));
      freshProducts.push(...cached.map(p => ({
        supplierSku: p.supplierSku,
        title: p.title,
        brand: p.brand || "",
        category: p.category,
        price: p.price / 100,
        stock: p.stock,
      })));
    }
  }

  return {
    products: freshProducts.slice(0, limit),
    fromCache: false,
    lastFetchAt: new Date(),
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
    const totalProducts = await db.select({ count: sql<number>`count(*)` }).from(productsCache);
    
    return {
      categories: metadata.map(m => ({
        category: m.category,
        lastFetchAt: m.lastFetchAt,
        productCount: m.productCount || 0,
        status: m.status || "idle",
        isStale: !m.lastFetchAt || (Date.now() - new Date(m.lastFetchAt).getTime()) / (1000 * 60 * 60) > (m.refreshIntervalHours || 24),
        refreshIntervalHours: m.refreshIntervalHours || 24,
      })),
      totalProducts: Number(totalProducts[0]?.count || 0),
    };
  }),

  refreshCache: protectedProcedure
    .input(z.object({
      categories: z.array(z.enum(["tire", "rim", "battery"])).default(["tire", "rim", "battery"]),
    }))
    .mutation(async ({ input }) => {
      const result = await getCachedProducts(input.categories, 100000, true);
      return {
        success: true,
        productCount: result.products.length,
        lastFetchAt: result.lastFetchAt,
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
      steps.push({ id: "1", name: "Ürün Verisi Yükleme", status: "running" });

      let supplierProducts: any[] = [];
      let fromCache = false;
      
      try {
        const result = await getCachedProducts(input.categories, input.productLimit, input.forceRefresh);
        supplierProducts = result.products;
        fromCache = result.fromCache;
        
        steps[0].status = "completed";
        steps[0].duration = Date.now() - step1Start;
        steps[0].message = fromCache 
          ? `${supplierProducts.length} ürün cache'den yüklendi` 
          : `${supplierProducts.length} ürün API'den çekildi ve cache'lendi`;
        steps[0].data = { productCount: supplierProducts.length, fromCache };
      } catch (error: any) {
        steps[0].status = "error";
        steps[0].message = error.message;
        steps[0].duration = Date.now() - step1Start;
        errors.push(`Ürün yükleme hatası: ${error.message}`);
      }

      const step2Start = Date.now();
      steps.push({ id: "2", name: "Ürün Verisi Ayrıştırma", status: "running" });
      
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
      
      steps[1].status = parsedCount > 0 ? "completed" : "error";
      steps[1].duration = Date.now() - step2Start;
      steps[1].message = `${parsedCount}/${supplierProducts.length} ürün ayrıştırıldı`;

      const step3Start = Date.now();
      steps.push({ id: "3", name: "Fiyat Kuralları Uygulama", status: "running" });
      
      for (const product of products) {
        if (product.status !== "error") {
          const margin = product.category === "tire" ? 1.25 : 
                        product.category === "rim" ? 1.30 : 1.20;
          product.calculatedPrice = Math.round(product.price * margin * 100) / 100;
        }
      }
      
      steps[2].status = "completed";
      steps[2].duration = Date.now() - step3Start;
      steps[2].message = `Fiyatlar hesaplandı`;

      const step4Start = Date.now();
      steps.push({ id: "4", name: "Shopify Hazırlık", status: "running" });
      
      const shopifyConfigured = !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);
      
      if (shopifyConfigured) {
        steps[3].status = "completed";
        steps[3].message = "Shopify bağlantısı hazır";
      } else {
        steps[3].status = "error";
        steps[3].message = "Shopify yapılandırması eksik";
        errors.push("Shopify env değişkenleri ayarlanmamış");
      }
      steps[3].duration = Date.now() - step4Start;

      for (const product of products) {
        if (product.status === "pending") {
          product.status = shopifyConfigured ? "success" : "skipped";
        }
      }

      return {
        success: errors.length === 0,
        sessionId: crypto.randomUUID(),
        steps,
        products,
        errors,
        fromCache,
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
      return {
        success: true,
        sessionId: crypto.randomUUID(),
        message: input.testMode 
          ? `Test modu: ${effectiveLimit} ürün işlenecek (${input.mode} sync)`
          : `${input.mode} sync başlatıldı`,
        config: {
          ...input,
          effectiveProductLimit: effectiveLimit,
        },
      };
    }),

  status: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return {
        sessionId: input.sessionId,
        status: "pending",
        message: "Sync status tracking (database integration pending)",
      };
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async () => {
      return {
        sessions: [],
        total: 0,
        message: "Sync history (database integration pending)",
      };
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
});
