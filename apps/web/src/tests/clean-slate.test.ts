async function verifyCleanSlate() {
  console.log("🔍 Verifying Clean Slate...");
  
  const { db, sqlFn } = await import("@my-better-t-app/db");
  const { supplierProducts, productsCache } = await import("@my-better-t-app/db/schema");
  
  const productCount = await db.select({ count: sqlFn<number>`count(*)` }).from(supplierProducts);
  const cacheCount = await db.select({ count: sqlFn<number>`count(*)` }).from(productsCache);
  
  const pCount = Number(productCount[0].count);
  const cCount = Number(cacheCount[0].count);

  console.log(`Current Supplier Products: ${pCount}`);
  console.log(`Current Products Cache: ${cCount}`);

  if (pCount === 0 && cCount === 0) {
    console.log("✅ Database is clean.");
    process.exit(0);
  } else {
    console.log("❌ Database is NOT clean.");
    process.exit(1);
  }
}

verifyCleanSlate().catch(err => {
  console.error(err);
  process.exit(1);
});