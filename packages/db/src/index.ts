import dotenv from "dotenv";

dotenv.config({
	path: "../../apps/server/.env",
});

import * as schema from "./schema";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, or, gt, lt, gte, lte, desc, asc, sql as sqlFn } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true

const sqlClient = neon(process.env.DATABASE_URL || "");
export const db = drizzle(sqlClient, { schema });
export { eq, and, or, gt, lt, gte, lte, desc, asc, sqlFn };
