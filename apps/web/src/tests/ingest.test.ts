async function verifyIngest() {
  console.log("🔍 Verifying Ingest Script...");
  
  const { db, eq } = await import("@my-better-t-app/db");
  const { supplierProducts } = await import("@my-better-t-app/db/schema");
  
  // 1. Check if DB has products
  const products = await db.select().from(supplierProducts).limit(10);
  
  console.log(`Found ${products.length} products after ingest.`);

  if (products.length === 0) {
    console.log("❌ No products found in DB.");
    process.exit(1);
  }

  // 2. Check if first product is in 'raw' status and has rawApiData
  const sample = products[0];
  console.log(`Sample Product: ${sample.supplierSku}`);
  console.log(`Status: ${sample.validationStatus}`);
  
  const hasRawData = sample.rawApiData && Object.keys(sample.rawApiData as object).length > 0;
  console.log(`Has Raw Data: ${hasRawData}`);

  if (sample.validationStatus === "raw" && hasRawData) {
    console.log("✅ Ingest verification successful.");
    process.exit(0);
  } else {
    console.log("❌ Ingest verification failed (Incorrect status or missing raw data).");
    process.exit(1);
  }
}

verifyIngest().catch(err => {
  console.error(err);
  process.exit(1);
});
