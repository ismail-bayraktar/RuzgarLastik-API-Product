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
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const locationId = process.env.SHOPIFY_LOCATION_ID;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";
    
    const configured = !!(shopDomain && accessToken && locationId);
    
    return {
      configured,
      shopDomain: shopDomain || null,
      locationId: locationId || null,
      apiVersion,
      hasAccessToken: !!accessToken,
    };
  }),

  testShopifyConnection: protectedProcedure.mutation(async () => {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";

    if (!shopDomain || !accessToken) {
      return {
        success: false,
        error: "Shopify bilgileri eksik (SHOPIFY_SHOP_DOMAIN veya SHOPIFY_ACCESS_TOKEN)",
      };
    }

    try {
      const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
      const query = `{ shop { name email myshopifyDomain primaryDomain { host } } }`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `API hatası: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();

      if (data.errors) {
        return {
          success: false,
          error: `GraphQL hatası: ${JSON.stringify(data.errors)}`,
        };
      }

      return {
        success: true,
        shop: data.data?.shop,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
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
