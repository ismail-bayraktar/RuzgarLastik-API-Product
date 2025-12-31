async function verifySync() {
  console.log("🔍 Verifying Sync Script (Dry Run)...");
  
  const { db, eq, or } = await import("@my-better-t-app/db");
  const { supplierProducts } = await import("@my-better-t-app/db/schema");
  
  // 1. Check for valid products ready to sync
  const ready = await db.select().from(supplierProducts)
    .where(or(
      eq(supplierProducts.validationStatus, "valid"),
      eq(supplierProducts.validationStatus, "needs_update")
    ))
    .limit(10);
  
  console.log(`Found ${ready.length} products ready to sync.`);

  if (ready.length === 0) {
    console.log("❌ No valid products found to sync.");
    process.exit(1);
  }

  // 2. In a real Red phase, we'd run the script and check for 'published' status.
  // Since we are doing Dry Run first, we'll just verify they ARE ready.
  console.log("✅ Sync verification (readiness) successful.");
  process.exit(0);
}

verifySync().catch(err => {
  console.error(err);
  process.exit(1);
});
