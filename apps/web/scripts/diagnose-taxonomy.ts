import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2024-10";

if (!SHOP || !TOKEN) {
  console.error("❌ Env variables missing!");
  process.exit(1);
}

const CANDIDATES = [
  "gid://shopify/TaxonomyCategory/aa-8",  // Lastik
  "gid://shopify/TaxonomyCategory/aa-11", // Jant
  "gid://shopify/TaxonomyCategory/aa-10", // Akü (Tahmin)
  "gid://shopify/TaxonomyCategory/aa-12", // Deneme
];

async function testCreate(categoryId: string) {
  const mutation = `
    mutation createProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id }
        userErrors { field message }
      }
    }
  `;

  const input = {
    title: `Taxonomy Test - ${categoryId}`,
    status: "DRAFT",
    category: categoryId, 
  };

  try {
    const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables: { product: input } }),
    });

    const json = await res.json();
    
    if (json.errors) {
        console.log(`❌ API Error for ${categoryId}: ${JSON.stringify(json.errors)}`);
        return false;
    }

    if (json.data?.productCreate?.userErrors?.length > 0) {
      console.log(`❌ Failed for ${categoryId}: ${json.data.productCreate.userErrors[0].message}`);
      return false;
    }
    
    const productId = json.data?.productCreate?.product?.id;
    if (productId) {
        console.log(`✅ SUCCESS for ${categoryId}! Created ID: ${productId}`);
        return true;
    } else {
        console.log(`❌ Unknown failure for ${categoryId} (No ID returned)`);
        return false;
    }
  } catch (e) {
    console.error(`Error testing ${categoryId}:`, e);
    return false;
  }
}

async function main() {
  console.log("🔍 Starting Taxonomy Brute Force Diagnosis (aa-1 to aa-30)...");
  
  for (let i = 1; i <= 30; i++) {
    const id = `gid://shopify/TaxonomyCategory/aa-${i}`;
    const success = await testCreate(id);
    if (success) {
        console.log(`🎉 VALID ID FOUND: ${id}`);
    }
    // Small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 200));
  }
}

main();
