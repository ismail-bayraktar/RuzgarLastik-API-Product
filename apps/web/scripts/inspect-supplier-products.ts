
import { db } from "@my-better-t-app/db";
import { supplierProducts } from "@my-better-t-app/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔍 Inspecting supplier_products table...");

  try {
    // 1. Toplam Kayıt Sayısı
    const totalCountResult = await db.select({ count: sql<number>`count(*)` }).from(supplierProducts);
    const totalCount = totalCountResult[0].count;
    console.log(`\n📊 Total Products: ${totalCount}`);

    // 2. Validation Status Dağılımı
    const statusDistribution = await db
      .select({
        status: supplierProducts.validationStatus,
        count: sql<number>`count(*)`
      })
      .from(supplierProducts)
      .groupBy(supplierProducts.validationStatus);

    console.log("\n📈 Status Distribution:");
    if (statusDistribution.length === 0) {
        console.log("   (No data found)");
    } else {
        statusDistribution.forEach(row => {
            console.log(`   - ${row.status || 'NULL'}: ${row.count}`);
        });
    }

    // 3. Örnek Bir Kayıt (Varsa)
    if (totalCount > 0) {
        const sample = await db.select().from(supplierProducts).limit(1);
        console.log("\n📝 Sample Product (First row):");
        console.log(JSON.stringify(sample[0], null, 2));
    }

  } catch (error) {
    console.error("❌ Error inspecting DB:", error);
  }

  process.exit(0);
}

main();
