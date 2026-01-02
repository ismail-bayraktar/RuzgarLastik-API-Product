const dotenv = require("dotenv");

dotenv.config();

async function diagnose() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  console.log(`Diagnosing connection to: ${shop}`);
  console.log(`Token starts with: ${token?.substring(0, 10)}...`);

  const url = `https://${shop}/admin/api/2024-10/shop.json`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": token || "",
        "Content-Type": "application/json"
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Connection Successful!");
      console.log(`Shop Name: ${data.shop.name}`);
    } else {
      const errorText = await response.text();
      console.error("❌ Connection Failed!");
      console.error(`Response Body: ${errorText}`);
    }
  } catch (err) {
    console.error("❌ Request Error:", err);
  }
}

diagnose();
