import { protectedProcedure, router } from "../index";
import { db } from "@my-better-t-app/db";
import { priceRules } from "@my-better-t-app/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
    .query(async ({ input }) => {
      const rules = await db.select().from(priceRules).orderBy(desc(priceRules.priority));
      return {
        rules: rules.map(r => ({
          id: r.id,
          category: r.category,
          brand: r.matchField === 'brand' ? r.matchValue : null,
          segment: r.matchField === 'segment' ? r.matchValue : null,
          marginPercent: Number(r.percentageMarkup) || 0,
          fixedMarkup: Number(r.fixedMarkup) || 0,
          priority: r.priority || 0,
          active: r.isActive ?? true,
        })),
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
      const matchField = input.brand ? 'brand' : input.segment ? 'segment' : 'category';
      const matchValue = input.brand || input.segment || input.category;
      
      const [rule] = await db.insert(priceRules).values({
        name: `${input.category} - ${matchValue}`,
        category: input.category,
        matchField,
        matchValue,
        percentageMarkup: String(input.marginPercent),
        fixedMarkup: input.fixedMarkup ? String(input.fixedMarkup) : null,
        isActive: input.active,
        priority: input.priority,
      }).returning();
      
      return {
        success: true,
        rule,
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
    const defaultRules = [
      { name: "Lastik - Premium", category: "tire", matchField: "segment", matchValue: "premium", percentageMarkup: "15", priority: 10 },
      { name: "Lastik - Orta", category: "tire", matchField: "segment", matchValue: "mid", percentageMarkup: "20", priority: 20 },
      { name: "Lastik - Ekonomi", category: "tire", matchField: "segment", matchValue: "economy", percentageMarkup: "25", priority: 30 },
      { name: "Jant - Premium", category: "rim", matchField: "segment", matchValue: "premium", percentageMarkup: "12", priority: 10 },
      { name: "Jant - Orta", category: "rim", matchField: "segment", matchValue: "mid", percentageMarkup: "18", priority: 20 },
      { name: "Akü - Genel", category: "battery", matchField: "category", matchValue: "battery", percentageMarkup: "22", priority: 50 },
    ];
    
    for (const rule of defaultRules) {
      await db.insert(priceRules).values({
        ...rule,
        isActive: true,
      }).onConflictDoNothing();
    }
    
    return {
      success: true,
      message: "Varsayılan kurallar oluşturuldu",
    };
  }),
});
