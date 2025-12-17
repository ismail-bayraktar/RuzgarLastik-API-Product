import { protectedProcedure, router } from "../index";
import { z } from "zod";

export const syncRouter = router({
  start: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["full", "incremental"]).default("incremental"),
        categories: z.array(z.enum(["tire", "rim", "battery"])).optional(),
        dryRun: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return {
        success: true,
        sessionId: crypto.randomUUID(),
        message: `${input.mode} sync started (orchestrator integration pending)`,
        config: input,
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
