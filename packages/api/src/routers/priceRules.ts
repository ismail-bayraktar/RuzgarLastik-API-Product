import { protectedProcedure, router } from "../index";
import { z } from "zod";

export const priceRulesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          category: z.enum(["tire", "rim", "battery"]).optional(),
          active: z.boolean().optional(),
        })
        .optional()
    )
    .query(async () => {
      return {
        rules: [],
        message: "Price rules service integration pending",
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        category: z.enum(["tire", "rim", "battery"]),
        brand: z.string().optional(),
        segment: z.enum(["premium", "mid", "economy"]).optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        marginPercent: z.number(),
        fixedMarkup: z.number().optional(),
        priority: z.number().default(10),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      return {
        success: true,
        message: "Price rule created (service integration pending)",
        rule: input,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z.enum(["tire", "rim", "battery"]).optional(),
        brand: z.string().optional(),
        segment: z.enum(["premium", "mid", "economy"]).optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        marginPercent: z.number().optional(),
        fixedMarkup: z.number().optional(),
        priority: z.number().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        success: true,
        message: "Price rule updated (service integration pending)",
        id: input.id,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return {
        success: true,
        message: "Price rule deleted (service integration pending)",
        id: input.id,
      };
    }),

  seedDefaults: protectedProcedure.mutation(async () => {
    return {
      success: true,
      message: "Default rules seeded (service integration pending)",
    };
  }),
});
