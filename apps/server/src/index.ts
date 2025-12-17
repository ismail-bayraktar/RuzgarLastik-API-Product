import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { auth } from "@my-better-t-app/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.get("/", (c) => {
	return c.text("OK");
});

app.get("/api/supplier-test", async (c) => {
	const url = c.req.query("url");
	if (!url) {
		return c.json({ success: false, error: "URL parameter is required" }, 400);
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return c.json({
				success: false,
				status: response.status,
				error: `API returned ${response.status}: ${response.statusText}`
			});
		}

		const data = await response.json();
		const isArray = Array.isArray(data);
		const products = isArray ? data : (data.products || data.data || []);
		
		return c.json({
			success: true,
			productCount: Array.isArray(products) ? products.length : 0,
			preview: Array.isArray(products) ? products.slice(0, 2) : products,
		});
	} catch (error: any) {
		return c.json({ success: false, error: error.message }, 500);
	}
});

const port = process.env.PORT || 5000;
console.log(`Server starting on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
