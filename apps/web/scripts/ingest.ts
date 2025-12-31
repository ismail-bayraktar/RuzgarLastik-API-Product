import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { db, eq } from "@my-better-t-app/db";
import { fetchJobs } from "@my-better-t-app/db/schema";
import { SupplierService } from "../src/services/supplierService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function runIngest() {
  const useMock = process.argv.includes("--mock") || process.env.USE_MOCK_SUPPLIER === "true";
  console.log(`🚀 Starting Ingestion (Mode: ${useMock ? "MOCK" : "LIVE"})...`);
  
  const supplierService = new SupplierService({ useMock });
  
  try {
    // Create a job record
    const [job] = await db.insert(fetchJobs).values({
      jobType: "full_fetch",
      status: "running",
      startedAt: new Date(),
      triggeredBy: "manual_script"
    }).returning();

    if (!job) throw new Error("Failed to create fetch job record.");

    const categories: Array<"tire" | "rim" | "battery"> = ["tire", "rim", "battery"];
    let totalFetched = 0;

    for (const category of categories) {
      console.log(`\n📦 Processing category: ${category}`);
      const stats = await supplierService.fetchAndIngest(category, job.id);
      totalFetched += stats.totalFetched;
      
      // Update job progress
      await db.update(fetchJobs).set({
        productsFetched: totalFetched,
        lastActivityAt: new Date()
      }).where(eq(fetchJobs.id, job.id));
    }

    await db.update(fetchJobs).set({
      status: "completed",
      finishedAt: new Date(),
      lastActivityAt: new Date()
    }).where(eq(fetchJobs.id, job.id));

    console.log(`\n✅ Ingestion complete! Total fetched: ${totalFetched}`);
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Ingestion failed:", error);
    process.exit(1);
  }
}

runIngest();
