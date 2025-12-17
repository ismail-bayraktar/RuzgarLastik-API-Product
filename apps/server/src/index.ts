import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { apiTestLogs } from "@my-better-t-app/db/schema";
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
	const category = c.req.query("category") || "unknown";
	
	if (!url) {
		return c.json({ success: false, error: "URL parameter is required" }, 400);
	}

	const startTime = Date.now();
	
	try {
		const response = await fetch(url);
		const responseTime = Date.now() - startTime;
		
		if (!response.ok) {
			const errorMessage = `API returned ${response.status}: ${response.statusText}`;
			
			try {
				await db.insert(apiTestLogs).values({
					category,
					url,
					success: false,
					statusCode: response.status,
					responseTimeMs: responseTime,
					errorMessage,
				});
				console.log(`[API TEST LOG] Saved: ${category} - error ${response.status}`);
			} catch (dbError) {
				console.error("[API TEST LOG] DB Insert Error:", dbError);
			}
			
			return c.json({
				success: false,
				status: response.status,
				error: errorMessage
			});
		}

		const data = await response.json();
		const isArray = Array.isArray(data);
		const products = isArray ? data : (data.products || data.data || []);
		const productCount = Array.isArray(products) ? products.length : 0;
		
		try {
			await db.insert(apiTestLogs).values({
				category,
				url,
				success: true,
				statusCode: 200,
				responseTimeMs: responseTime,
				productCount,
			});
			console.log(`[API TEST LOG] Saved: ${category} - success`);
		} catch (dbError) {
			console.error("[API TEST LOG] DB Insert Error:", dbError);
		}
		
		return c.json({
			success: true,
			productCount,
			preview: Array.isArray(products) ? products.slice(0, 2) : products,
		});
	} catch (error: any) {
		const responseTime = Date.now() - startTime;
		
		try {
			await db.insert(apiTestLogs).values({
				category,
				url,
				success: false,
				responseTimeMs: responseTime,
				errorMessage: error.message,
			});
			console.log(`[API TEST LOG] Saved: ${category} - catch error`);
		} catch (dbError) {
			console.error("[API TEST LOG] DB Insert Error:", dbError);
		}
		
		return c.json({ success: false, error: error.message }, 500);
	}
});

const port = process.env.PORT || 5000;
console.log(`Server starting on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
