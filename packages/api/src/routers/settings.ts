import { protectedProcedure, router } from "../index";
import { z } from "zod";

export const settingsRouter = router({
  get: protectedProcedure.query(async () => {
    return {
      settings: {
        useMockSupplier: true,
        syncMode: "incremental",
        batchSize: 50,
        syncConcurrency: 5,
        maxRetries: 3,
      },
      message: "Settings retrieval (database integration pending)",
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        useMockSupplier: z.boolean().optional(),
        syncMode: z.enum(["full", "incremental"]).optional(),
        batchSize: z.number().optional(),
        syncConcurrency: z.number().optional(),
        maxRetries: z.number().optional(),
        syncCategories: z.array(z.enum(["tire", "rim", "battery"])).optional(),
        syncMinStock: z.number().optional(),
        syncOnlyInStock: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        success: true,
        message: "Settings updated (database integration pending)",
        settings: input,
      };
    }),

  shopifyConfig: protectedProcedure.query(async () => {
    return {
      configured: false,
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || null,
      locationId: process.env.SHOPIFY_LOCATION_ID || null,
      apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",
      message: "Shopify configuration check",
    };
  }),

  supplierConfig: protectedProcedure.query(async () => {
    return {
      useMock: process.env.USE_MOCK_SUPPLIER === "true",
      apiUrl: process.env.SUPPLIER_API_URL || null,
      configured: process.env.USE_MOCK_SUPPLIER === "true" || !!process.env.SUPPLIER_API_URL,
      message: "Supplier configuration check",
    };
  }),
});
