import { protectedProcedure, router } from "../index";
import { z } from "zod";

export const productsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        category: z.enum(["tire", "rim", "battery"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async () => {
      return {
        products: [],
        total: 0,
        message: "Product list (database integration pending)",
      };
    }),

  getBySupplierSku: protectedProcedure
    .input(z.object({ supplierSku: z.string() }))
    .query(async ({ input }) => {
      return {
        product: null,
        message: `Product lookup for SKU: ${input.supplierSku} (database integration pending)`,
      };
    }),

  syncStats: protectedProcedure.query(async () => {
    return {
      totalProducts: 0,
      bySyncStatus: {
        synced: 0,
        pending: 0,
        failed: 0,
      },
      byCategory: {
        tire: 0,
        rim: 0,
        battery: 0,
      },
      message: "Sync statistics (database integration pending)",
    };
  }),
});
