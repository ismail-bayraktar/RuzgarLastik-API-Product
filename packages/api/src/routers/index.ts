import { protectedProcedure, publicProcedure, router } from "../index";
import { syncRouter } from "./sync";
import { productsRouter } from "./products";
import { priceRulesRouter } from "./priceRules";
import { settingsRouter } from "./settings";
import { supplierProductsRouter } from "./supplierProducts";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return { status: "OK", timestamp: new Date().toISOString() };
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	sync: syncRouter,
	products: productsRouter,
	priceRules: priceRulesRouter,
	settings: settingsRouter,
	supplierProducts: supplierProductsRouter,
});
export type AppRouter = typeof appRouter;
