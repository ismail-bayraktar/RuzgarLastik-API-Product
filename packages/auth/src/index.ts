import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@my-better-t-app/db";
import * as schema from "@my-better-t-app/db/schema/auth";

const isDev = process.env.NODE_ENV !== "production";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:3000"],
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		defaultCookieAttributes: {
			// Development'ta secure=false ve sameSite=lax olmalı
			sameSite: isDev ? "lax" : "none",
			secure: !isDev,
			httpOnly: true,
		},
		disableTelemetry: true,
	},
});
