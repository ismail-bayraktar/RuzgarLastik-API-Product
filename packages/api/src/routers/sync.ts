import { protectedProcedure, router } from "../index";
import { db } from "@my-better-t-app/db";
import { apiTestLogs } from "@my-better-t-app/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

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
