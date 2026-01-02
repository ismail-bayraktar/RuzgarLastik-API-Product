#!/usr/bin/env bun
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

async function main() {
  const { db } = await import("@my-better-t-app/db");
  const { supplierProducts } = await import("@my-better-t-app/db/schema");

  const samples = await db.select({
    supplierSku: supplierProducts.supplierSku,
    title: supplierProducts.title,
    price: supplierProducts.currentPrice,
    stock: supplierProducts.currentStock,
    images: supplierProducts.images,
    validationStatus: supplierProducts.validationStatus,
    validationErrors: supplierProducts.validationErrors,
    generatedSku: supplierProducts.generatedSku,
  }).from(supplierProducts).limit(3);

  console.log("Sample products after validation:\n");
  console.log(JSON.stringify(samples, null, 2));
}

main().catch(console.error);
