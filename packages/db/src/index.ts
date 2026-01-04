import dotenv from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// ÇALIŞMA DİZİNİ KONTROLÜ (Debug için)
const cwd = process.cwd();

// Arama yapılacak yollar (Next.js ve Scriptler için)
const envPaths = [
	resolve(cwd, ".env"),
	resolve(cwd, "../../.env"),
	resolve(cwd, "apps/web/.env"),
	resolve(cwd, "ruzgarlastik-prd-sync/.env"), // Tam yol denemesi
];

let loaded = false;
for (const fullPath of envPaths) {
	if (existsSync(fullPath)) {
		dotenv.config({ path: fullPath });
		console.log(`[DB-INIT] Environment loaded from: ${fullPath}`);
		loaded = true;
		break;
	}
}

if (!loaded && !process.env.DATABASE_URL) {
    console.warn("[DB-INIT] WARNING: No .env file found in expected locations.");
}

import * as schema from "./schema";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, or, gt, lt, gte, lte, desc, asc, sql as sqlFn, inArray, ne, isNotNull, isNull, like, ilike } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const dbUrl = process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy";

if (!process.env.DATABASE_URL) {
    console.warn(
        "[DB-INIT] WARNING: DATABASE_URL is missing. Using dummy URL for build/initialization safety. " +
        `Checked directory: ${cwd}`
    );
}

const sqlClient = neon(dbUrl);
export const db = drizzle(sqlClient, { schema });
export { eq, and, or, gt, lt, gte, lte, desc, asc, sqlFn, inArray, ne, isNotNull, isNull, like, ilike };