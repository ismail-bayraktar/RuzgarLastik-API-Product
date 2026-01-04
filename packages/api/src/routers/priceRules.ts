import { protectedProcedure, router } from "../index";
import { db, desc, eq } from "@my-better-t-app/db";
import { priceRules } from "@my-better-t-app/db/schema";
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
    .query(async ({ input: _input }) => {
      // TODO: Use _input to filter by category/active status
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
        id: z.number(),
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
      const { id, active, ...rest } = input;
      
      await db.update(priceRules)
        .set({
          isActive: active,
          ...(rest.marginPercent !== undefined && { percentageMarkup: String(rest.marginPercent) }),
          ...(rest.fixedMarkup !== undefined && { fixedMarkup: String(rest.fixedMarkup) }),
          ...(rest.priority !== undefined && { priority: rest.priority }),
          updatedAt: new Date(),
        })
        .where(eq(priceRules.id, id));

      return {
        success: true,
        id,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(priceRules).where(eq(priceRules.id, input.id));
      return {
        success: true,
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
