import { db } from "../index";
import { productMap } from "../schema/product";
import { eq } from "drizzle-orm";

async function testRawData() {
    const sku = "TEST-RAW-DATA-" + Date.now();
    const testRaw = { supplier_id: 123, raw_name: "Test Product" };

    try {
        console.log("Attempting to insert product with rawData...");
        // @ts-ignore - Anticipating schema change
        await db.insert(productMap).values({
            sku: sku,
            category: "test",
            rawData: testRaw
        });

        const result = await db.select().from(productMap).where(eq(productMap.sku, sku));
        
        // @ts-ignore
        if (result.length > 0 && JSON.stringify(result[0].rawData) === JSON.stringify(testRaw)) {
            console.log("✅ rawData saved and retrieved successfully");
            
            // Clean up
            await db.delete(productMap).where(eq(productMap.sku, sku));
            process.exit(0);
        } else {
            console.error("❌ rawData mismatch or missing");
            console.error("Result:", result);
            process.exit(1);
        }

    } catch (e) {
        console.error("❌ Test failed:", e);
        process.exit(1);
    }
}

testRawData();
