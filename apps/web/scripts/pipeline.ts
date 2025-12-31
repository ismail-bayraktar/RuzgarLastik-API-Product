import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runScript(scriptName: string, args: string[] = []) {
  console.log(`\n--- Running ${scriptName} ${args.join(" ")} ---`);
  const scriptPath = path.resolve(__dirname, scriptName);
  
  const result = spawnSync("npx", ["tsx", scriptPath, ...args], {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    console.error(`❌ Script ${scriptName} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

async function runPipeline() {
  const useMock = process.argv.includes("--mock");
  const dryRun = process.argv.includes("--dry-run");

  console.log("============================================");
  console.log("🚀 Ruzgar Lastik Unified Pipeline");
  console.log(`Mode: ${useMock ? "MOCK" : "LIVE"}`);
  console.log(`Sync: ${dryRun ? "DRY RUN" : "LIVE SYNC"}`);
  console.log("============================================\n");

  // Step 1: Ingest
  runScript("ingest.ts", useMock ? ["--mock"] : []);

  // Step 2: Process
  runScript("process.ts");

  // Step 3: Sync
  runScript("sync.ts", dryRun ? ["--dry-run"] : []);

  console.log("\n============================================");
  console.log("✅ Pipeline completed successfully!");
  console.log("============================================");
}

runPipeline().catch(err => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
