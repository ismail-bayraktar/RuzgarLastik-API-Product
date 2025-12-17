import { protectedProcedure, publicProcedure, router } from "../index";
import { syncRouter } from "./sync";
import { productsRouter } from "./products";
import { priceRulesRouter } from "./priceRules";
import { settingsRouter } from "./settings";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
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
});
export type AppRouter = typeof appRouter;
