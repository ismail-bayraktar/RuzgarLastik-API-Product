import dotenv from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// Try multiple .env paths to support different working directories
const envPaths = [
	".env",                           // Current directory (apps/web or apps/server)
	"../../apps/server/.env",         // From packages/db
	"../server/.env",                 // From apps/web
];

for (const envPath of envPaths) {
	const fullPath = resolve(process.cwd(), envPath);
	if (existsSync(fullPath)) {
		dotenv.config({ path: fullPath });
		break;
	}
}

import * as schema from "./schema";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, or, gt, lt, gte, lte, desc, asc, sql as sqlFn, inArray, ne, isNotNull, isNull, like, ilike } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true

const sqlClient = neon(process.env.DATABASE_URL || "");
export const db = drizzle(sqlClient, { schema });
export { eq, and, or, gt, lt, gte, lte, desc, asc, sqlFn, inArray, ne, isNotNull, isNull, like, ilike };
