import dotenv from "dotenv";
dotenv.config({ path: "../../apps/server/.env" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL || "");

async function run() {
    console.log("Adding raw_data column...");
    try {
        await sql`ALTER TABLE "product_map" ADD COLUMN IF NOT EXISTS "raw_data" json`;
        console.log("✅ Success");
    } catch (e: any) {
        console.error("❌ Error:", e);
        process.exit(1);
    }
}

run();
