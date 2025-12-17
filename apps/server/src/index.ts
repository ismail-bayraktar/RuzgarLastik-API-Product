import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(import.meta.dir, "../.env");
console.log("[ENV] Loading from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
	console.error("[ENV] Error:", result.error.message);
} else {
	console.log("[ENV] Loaded vars:", Object.keys(result.parsed || {}).length);
}
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

app.get("/api/shopify-test", async (c) => {
	const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
	const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
	const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";
	const locationId = process.env.SHOPIFY_LOCATION_ID;

	if (!shopDomain || !accessToken) {
		return c.json({
			success: false,
			error: "Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ACCESS_TOKEN",
			config: {
				shopDomain: shopDomain ? "Set" : "Missing",
				accessToken: accessToken ? "Set" : "Missing",
				locationId: locationId ? "Set" : "Missing",
				apiVersion,
			}
		}, 400);
	}

	try {
		const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
		const query = `{
			shop {
				name
				email
				myshopifyDomain
				primaryDomain {
					host
				}
			}
		}`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": accessToken,
			},
			body: JSON.stringify({ query }),
		});

		if (!response.ok) {
			return c.json({
				success: false,
				error: `Shopify API error: ${response.status} ${response.statusText}`,
				statusCode: response.status,
			});
		}

		const data = await response.json();

		if (data.errors) {
			return c.json({
				success: false,
				error: "GraphQL errors",
				errors: data.errors,
			});
		}

		return c.json({
			success: true,
			shop: data.data?.shop,
			config: {
				shopDomain,
				apiVersion,
				locationId: locationId || "Not set",
			}
		});
	} catch (error: any) {
		return c.json({
			success: false,
			error: error.message,
		}, 500);
	}
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
