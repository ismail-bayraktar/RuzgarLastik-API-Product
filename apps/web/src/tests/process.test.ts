async function verifyProcess() {
  console.log("🔍 Verifying Process Script...");
  
  const { db, eq, isNotNull } = await import("@my-better-t-app/db");
  const { supplierProducts } = await import("@my-better-t-app/db/schema");
  
  // 1. Check for processed products
  const processed = await db.select().from(supplierProducts)
    .where(isNotNull(supplierProducts.generatedSku))
    .limit(10);
  
  console.log(`Found ${processed.length} processed products.`);

  if (processed.length === 0) {
    console.log("❌ No processed products found (Expects generatedSku to be filled).");
    process.exit(1);
  }

  // 2. Check if first product is in 'valid' or 'invalid' status
  const sample = processed[0];
  console.log(`Sample Product: ${sample.supplierSku}`);
  console.log(`Status: ${sample.validationStatus}`);
  console.log(`Generated SKU: ${sample.generatedSku}`);

  if (["valid", "invalid"].includes(sample.validationStatus)) {
    console.log("✅ Process verification successful.");
    process.exit(0);
  } else {
    console.log("❌ Process verification failed (Incorrect status).");
    process.exit(1);
  }
}

verifyProcess().catch(err => {
  console.error(err);
  process.exit(1);
});
