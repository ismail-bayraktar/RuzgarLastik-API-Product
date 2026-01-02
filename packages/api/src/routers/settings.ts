import { protectedProcedure, router } from "../index";
import { db, eq } from "@my-better-t-app/db";
import { settings } from "@my-better-t-app/db/schema";
import { z } from "zod";

// Sync automation settings schema
const syncAutomationSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.enum(["1h", "3h", "6h", "12h", "24h", "manual"]).default("6h"),
  preferredHours: z.array(z.number().min(0).max(23)).default([2, 8, 14, 20]),
  categories: z.array(z.enum(["tire", "rim", "battery"])).default(["tire", "rim", "battery"]),
  notifications: z.object({
    email: z.boolean().default(false),
    emailAddress: z.string().email().optional(),
    onSuccess: z.boolean().default(true),
    onError: z.boolean().default(true),
    onWarning: z.boolean().default(false),
  }).default({
    email: false,
    onSuccess: true,
    onError: true,
    onWarning: false,
  }),
  skipErrorProducts: z.boolean().default(false),
  dryRunFirst: z.boolean().default(true),
});

type SyncAutomationSettings = z.infer<typeof syncAutomationSchema>;

const SYNC_AUTOMATION_KEY = "sync_automation";

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

      const data = await response.json() as {
        errors?: unknown;
        data?: { shop?: unknown };
      };

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

  // Sync Automation Settings
  getSyncAutomation: protectedProcedure.query(async () => {
    try {
      const result = await db
        .select()
        .from(settings)
        .where(eq(settings.key, SYNC_AUTOMATION_KEY))
        .limit(1);

      if (result.length === 0) {
        // Return default settings
        return {
          success: true,
          settings: syncAutomationSchema.parse({}),
        };
      }

      const parsed = JSON.parse(result[0]!.value);
      return {
        success: true,
        settings: syncAutomationSchema.parse(parsed),
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: (error as Error).message,
        settings: syncAutomationSchema.parse({}),
      };
    }
  }),

  updateSyncAutomation: protectedProcedure
    .input(syncAutomationSchema.partial())
    .mutation(async ({ input }) => {
      try {
        // Get existing settings first
        const existing = await db
          .select()
          .from(settings)
          .where(eq(settings.key, SYNC_AUTOMATION_KEY))
          .limit(1);

        let currentSettings: SyncAutomationSettings;
        if (existing.length > 0) {
          currentSettings = syncAutomationSchema.parse(JSON.parse(existing[0]!.value));
        } else {
          currentSettings = syncAutomationSchema.parse({});
        }

        // Merge with input
        const updatedSettings: SyncAutomationSettings = {
          ...currentSettings,
          ...input,
          notifications: {
            ...currentSettings.notifications,
            ...(input.notifications || {}),
          },
        };

        const jsonValue = JSON.stringify(updatedSettings);

        // Upsert settings
        await db
          .insert(settings)
          .values({
            key: SYNC_AUTOMATION_KEY,
            value: jsonValue,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: jsonValue,
              updatedAt: new Date(),
            },
          });

        return {
          success: true,
          settings: updatedSettings,
        };
      } catch (error: unknown) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),

  // Get next scheduled sync time based on settings
  getNextSyncTime: protectedProcedure.query(async () => {
    try {
      const result = await db
        .select()
        .from(settings)
        .where(eq(settings.key, SYNC_AUTOMATION_KEY))
        .limit(1);

      let automationSettings: SyncAutomationSettings;
      if (result.length > 0) {
        automationSettings = syncAutomationSchema.parse(JSON.parse(result[0]!.value));
      } else {
        automationSettings = syncAutomationSchema.parse({});
      }

      if (!automationSettings.enabled || automationSettings.interval === "manual") {
        return {
          enabled: automationSettings.enabled,
          interval: automationSettings.interval,
          nextSync: null,
          nextSyncLabel: "Manuel tetikleme",
        };
      }

      const now = new Date();
      const currentHour = now.getHours();
      const preferredHours = automationSettings.preferredHours.sort((a, b) => a - b);

      // Find next preferred hour
      let nextHour = preferredHours.find(h => h > currentHour);
      let isToday = true;

      if (nextHour === undefined) {
        nextHour = preferredHours[0] || 0;
        isToday = false;
      }

      const nextSync = new Date(now);
      if (!isToday) {
        nextSync.setDate(nextSync.getDate() + 1);
      }
      nextSync.setHours(nextHour, 0, 0, 0);

      const day = isToday ? "Bugun" : "Yarin";
      const hourStr = nextHour.toString().padStart(2, "0");

      return {
        enabled: automationSettings.enabled,
        interval: automationSettings.interval,
        nextSync: nextSync.toISOString(),
        nextSyncLabel: `${day} ${hourStr}:00`,
      };
    } catch (error: unknown) {
      return {
        enabled: false,
        interval: "manual",
        nextSync: null,
        nextSyncLabel: "Hata",
        error: (error as Error).message,
      };
    }
  }),
});
