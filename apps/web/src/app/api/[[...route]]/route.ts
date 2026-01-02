import { Hono } from "hono";
import { handle } from "hono/vercel";
import { auth } from "@my-better-t-app/auth";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { db, eq } from "@my-better-t-app/db";
import { cors } from "hono/cors";

// Next.js Unified API Router
const app = new Hono().basePath("/api");

app.use("*", cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));

// Better-Auth Entegrasyonu
app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

// tRPC Entegrasyonu
app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

// Health Check - Saf JSON
app.get("/health", (c) => c.json({ status: "OK", timestamp: new Date().toISOString() }));

// --- Supplier API Test Endpoint ---
app.get("/supplier-test", async (c) => {
    const category = c.req.query("category") || "unknown";
    
    const baseUrl = process.env.SUPPLIER_API_URL;
    const customerId = process.env.SUPPLIER_CUSTOMER_ID;
    const apiKey = process.env.SUPPLIER_API_KEY;
    
    const categoryIds: Record<string, string | undefined> = {
        "Lastik": process.env.CATEGORY_ID_LASTIK,
        "Jant": process.env.CATEGORY_ID_JANT,
        "Jant On Siparis": process.env.CATEGORY_ID_JANT_PREORDER,
        "Aku": process.env.CATEGORY_ID_AKU,
        "Katalog": process.env.CATEGORY_ID_CATALOG
    };

    const catId = categoryIds[category];
    
    if (!baseUrl || !customerId || !apiKey) {
        return c.json({ success: false, error: "Tedarikçi API ayarları (.env) eksik!" });
    }

    const url = `${baseUrl}/${customerId}/${apiKey}/${catId || ""}`;

    try {
        let response: Response | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            response = await fetch(url);
            if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                attempts++;
                continue;
            }
            break;
        }

        if (!response || !response.ok) {
            return c.json({ success: false, error: `Tedarikçi Hatası (${response?.status || 'Unknown'})` });
        }

        const data = await response.json();
        const products = Array.isArray(data) ? data : (data.products || data.data || []);
        
        return c.json({
            success: true,
            productCount: products.length,
            preview: products.slice(0, 2),
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message });
    }
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
