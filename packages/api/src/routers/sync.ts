import { protectedProcedure, router } from "../index";
import { db } from "@my-better-t-app/db";
import { apiTestLogs } from "@my-better-t-app/db/schema";
import { desc } from "drizzle-orm";
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

  preview: protectedProcedure
    .input(
      z.object({
        categories: z.array(z.enum(["tire", "rim", "battery"])).default(["tire", "rim", "battery"]),
        productLimit: z.number().min(1).max(100).default(5),
      })
    )
    .mutation(async ({ input }) => {
      const steps: SyncStep[] = [];
      const products: ProductPreview[] = [];
      const errors: string[] = [];

      // Step 1: Tedarikçi API bağlantısı
      const step1Start = Date.now();
      steps.push({ id: "1", name: "Tedarikçi API Bağlantısı", status: "running" });
      
      let supplierProducts: any[] = [];
      try {
        const useMock = process.env.USE_MOCK_SUPPLIER === "true";
        
        for (const category of input.categories) {
          let url: string | undefined;
          
          if (useMock) {
            // Mock data kullan
            const mockData = await import("../../../server/src/data/mock-products.json");
            const categoryData = category === "tire" ? mockData.default.tires : 
                                 category === "rim" ? mockData.default.rims : 
                                 mockData.default.batteries;
            supplierProducts = supplierProducts.concat(categoryData.slice(0, Math.ceil(input.productLimit / input.categories.length)));
          } else {
            if (category === "tire") url = process.env.SUPPLIER_API_LASTIK;
            if (category === "rim") url = process.env.SUPPLIER_API_JANT;
            if (category === "battery") url = process.env.SUPPLIER_API_AKU;
            
            if (url) {
              const response = await fetch(url);
              if (response.ok) {
                const data = await response.json();
                const rawProducts = Array.isArray(data) ? data : (data.products || data.data || []);
                supplierProducts = supplierProducts.concat(
                  rawProducts.slice(0, Math.ceil(input.productLimit / input.categories.length)).map((p: any) => ({
                    supplierSku: p.StokKodu || p.sku || p.id,
                    title: p.StokAdi || p.name || p.title,
                    brand: p.Marka || p.brand || "",
                    model: p.Model || p.model || "",
                    category,
                    price: parseFloat(p.Fiyat || p.price || "0"),
                    stock: parseInt(p.StokAdet || p.stock || "0"),
                  }))
                );
              } else {
                errors.push(`${category} API hatası: ${response.status}`);
              }
            }
          }
        }
        
        steps[0].status = "completed";
        steps[0].duration = Date.now() - step1Start;
        steps[0].message = `${supplierProducts.length} ürün bulundu`;
        steps[0].data = { productCount: supplierProducts.length };
      } catch (error: any) {
        steps[0].status = "error";
        steps[0].message = error.message;
        steps[0].duration = Date.now() - step1Start;
        errors.push(`Tedarikçi API hatası: ${error.message}`);
      }

      // Limit products
      supplierProducts = supplierProducts.slice(0, input.productLimit);

      // Step 2: Title Parsing
      const step2Start = Date.now();
      steps.push({ id: "2", name: "Ürün Verisi Ayrıştırma", status: "running" });
      
      let parsedCount = 0;
      for (const product of supplierProducts) {
        try {
          // Basic title parsing simulation
          const parsed = {
            ...product,
            parsed: true,
          };
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

      // Step 3: Fiyat hesaplama
      const step3Start = Date.now();
      steps.push({ id: "3", name: "Fiyat Kuralları Uygulama", status: "running" });
      
      for (const product of products) {
        if (product.status !== "error") {
          // Simple margin calculation (will be replaced with real rules)
          const margin = product.category === "tire" ? 1.25 : 
                        product.category === "rim" ? 1.30 : 1.20;
          product.calculatedPrice = Math.round(product.price * margin * 100) / 100;
        }
      }
      
      steps[2].status = "completed";
      steps[2].duration = Date.now() - step3Start;
      steps[2].message = `Fiyatlar hesaplandı (örnek: %${products[0]?.category === "tire" ? 25 : products[0]?.category === "rim" ? 30 : 20} marj)`;

      // Step 4: Shopify hazırlık
      const step4Start = Date.now();
      steps.push({ id: "4", name: "Shopify Hazırlık", status: "running" });
      
      const shopifyConfigured = !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);
      
      if (shopifyConfigured) {
        steps[3].status = "completed";
        steps[3].message = "Shopify bağlantısı hazır";
      } else {
        steps[3].status = "error";
        steps[3].message = "Shopify yapılandırması eksik (SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN)";
        errors.push("Shopify env değişkenleri ayarlanmamış");
      }
      steps[3].duration = Date.now() - step4Start;

      // Mark products as ready
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
