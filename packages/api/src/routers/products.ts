import { protectedProcedure, router } from "../index";
import { db, eq, desc, sqlFn, like, or, and } from "@my-better-t-app/db";
import { supplierProducts, productMap } from "@my-better-t-app/db/schema";
import { z } from "zod";

export const productsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        category: z.enum(["tire", "rim", "battery"]).optional(),
        status: z.enum(["raw", "valid", "invalid", "published", "needs_update", "inactive"]).optional(),
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const { category, status, search, limit, offset } = input;
      
      let whereClause = undefined;
      const filters = [];
      
      if (category) filters.push(eq(supplierProducts.category, category));
      if (status) filters.push(eq(supplierProducts.validationStatus, status));
      if (search) {
        filters.push(or(
          like(supplierProducts.supplierSku, `%${search}%`),
          like(supplierProducts.title, `%${search}%`),
          like(supplierProducts.brand, `%${search}%`)
        ));
      }
      
      if (filters.length > 0) {
        whereClause = and(...filters);
      }

      const products = await db
        .select()
        .from(supplierProducts)
        .where(whereClause)
        .orderBy(desc(supplierProducts.updatedAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sqlFn<number>`count(*)` })
        .from(supplierProducts)
        .where(whereClause);

      return {
        products: products.map(p => ({
          id: p.id,
          sku: p.supplierSku,
          title: p.title,
          brand: p.brand,
          category: p.category,
          price: (p.currentPrice || 0) / 100,
          stock: p.currentStock,
          status: p.validationStatus,
          shopifyId: p.shopifyProductId,
          errors: p.validationErrors,
          updatedAt: p.updatedAt,
        })),
        total: Number(countResult[0]?.count || 0),
      };
    }),

  getBySupplierSku: protectedProcedure
    .input(z.object({ supplierSku: z.string() }))
    .query(async ({ input }) => {
      const product = await db
        .select()
        .from(supplierProducts)
        .where(eq(supplierProducts.supplierSku, input.supplierSku))
        .limit(1);

      return {
        product: product[0] || null,
      };
    }),

  syncStats: protectedProcedure.query(async () => {
    const stats = await db
      .select({
        status: supplierProducts.validationStatus,
        count: sqlFn<number>`count(*)`
      })
      .from(supplierProducts)
      .groupBy(supplierProducts.validationStatus);

    const categoryStats = await db
      .select({
        category: supplierProducts.category,
        count: sqlFn<number>`count(*)`
      })
      .from(supplierProducts)
      .groupBy(supplierProducts.category);

    const totalSynced = await db
      .select({ count: sqlFn<number>`count(*)` })
      .from(productMap);

    return {
      totalProducts: categoryStats.reduce((acc, curr) => acc + Number(curr.count), 0),
      bySyncStatus: {
        synced: Number(totalSynced[0]?.count || 0),
        pending: Number(stats.find(s => s.status === 'valid')?.count || 0),
        failed: Number(stats.find(s => s.status === 'invalid')?.count || 0),
      },
      byCategory: {
        tire: Number(categoryStats.find(c => c.category === 'tire')?.count || 0),
        rim: Number(categoryStats.find(c => c.category === 'rim')?.count || 0),
        battery: Number(categoryStats.find(c => c.category === 'battery')?.count || 0),
      },
    };
  }),
});
