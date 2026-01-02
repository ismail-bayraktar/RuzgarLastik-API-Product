#!/usr/bin/env bun
/**
 * Script to run validation on all existing products
 */

import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(import.meta.dir, "../../.env");
dotenv.config({ path: envPath });

async function main() {
  const { validationService } = await import("../src/services/validationService");

  console.log("Starting validation of existing products...\n");

  const stats = await validationService.validateAll();

  console.log("\n==========================================");
  console.log("Validation Results");
  console.log("==========================================");
  console.log(`Total Products: ${stats.total}`);
  console.log(`RAW (unvalidated): ${stats.raw}`);
  console.log(`VALID: ${stats.valid}`);
  console.log(`INVALID: ${stats.invalid}`);
  console.log(`PUBLISHED: ${stats.published}`);
  console.log(`NEEDS UPDATE: ${stats.needsUpdate}`);
  console.log(`INACTIVE: ${stats.inactive}`);
  console.log("\nInvalid Reasons:");
  for (const [reason, count] of Object.entries(stats.byReason)) {
    console.log(`  - ${reason}: ${count}`);
  }
  console.log("==========================================");
}

main().catch(console.error);
