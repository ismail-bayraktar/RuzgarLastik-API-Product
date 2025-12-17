# 04 - Data Flows & Architecture Diagrams

## 📋 İçindekiler

1. [End-to-End Sync Flow](#end-to-end-sync-flow)
2. [Supplier API Data Flow](#supplier-api-data-flow)
3. [Title Parsing Flow](#title-parsing-flow)
4. [Pricing Rules Flow](#pricing-rules-flow)
5. [Shopify Sync Flow](#shopify-sync-flow)
6. [Error Handling Flow](#error-handling-flow)
7. [Admin Dashboard Interaction](#admin-dashboard-interaction)

---

## End-to-End Sync Flow

### High-Level Orchestration

```
┌─────────────────────────────────────────────────────┐
│ ADMIN / GitHub Actions                              │
└────────────────────┬────────────────────────────────┘
                     │
                     │ POST /api/trpc/sync.start
                     ↓
┌─────────────────────────────────────────────────────┐
│ Hono Backend - Sync Orchestrator                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Validate Input (categories, limit, mode)      │
│     ├─ Check auth (Better Auth session)           │
│     └─ Validate input (Zod schema)                │
│                                                     │
│  2. Create Sync Session (DB)                      │
│     ├─ ID, startedAt, status: "running"           │
│     └─ Store in sync_sessions table               │
│                                                     │
│  3. Initialize Services                            │
│     ├─ SupplierService                            │
│     ├─ ShopifyService                             │
│     ├─ TitleParserService                         │
│     ├─ PricingRulesService                        │
│     └─ RateLimiterService                         │
│                                                     │
│  4. LOOP: Process Products                         │
│     ├─ [For each product] →                       │
│     │   4.1 Fetch from Supplier (batched)        │
│     │   4.2 Parse & Normalize (title, category)  │
│     │   4.3 Calculate Price (rules engine)        │
│     │   4.4 Detect Changes (hash diff)            │
│     │   4.5 Sync to Shopify (create/update)       │
│     │   4.6 Log Result (success/error)            │
│     │   4.7 Update Metafields (separate)          │
│     │   4.8 Rate Limit Check (backoff if needed)  │
│     └─ [Next batch]                               │
│                                                     │
│  5. Aggregate Results                              │
│     ├─ Total products processed                   │
│     ├─ Created count                              │
│     ├─ Updated count                              │
│     ├─ Failed count                               │
│     └─ Error summary                              │
│                                                     │
│  6. Update Sync Session (DB)                      │
│     ├─ Status: success | partial | failed         │
│     ├─ FinishedAt: timestamp                      │
│     ├─ Stats: counts, error messages              │
│     └─ Mark complete                              │
│                                                     │
│  7. Notify (optional: Slack, Email)               │
│                                                     │
└────────────────────┬────────────────────────────────┘
                     │
                     │ Response: SyncSession
                     ↓
┌─────────────────────────────────────────────────────┐
│ Admin Dashboard                                     │
├─────────────────────────────────────────────────────┤
│ ✅ Sync completed                                  │
│ 📊 Stats: 500 created, 1200 updated, 10 failed    │
│ ⏱️ Duration: 8m 32s                                │
│ 🔗 View details / logs                            │
└─────────────────────────────────────────────────────┘
```

---

## Supplier API Data Flow

### 1. Fetch Phase

```
┌──────────────────────────────┐
│ SupplierService              │
│ .fetchProducts(limit, page)  │
└──────────────┬───────────────┘
               │
               ├─ Check: Mock or Real?
               │
               ├─ MOCK Path:
               │  └─ Read from /data/mock-products.json
               │
               └─ REAL Path:
                  ├─ Build URL: ${SUPPLIER_API_URL}/products?limit=50&page=1
                  ├─ Add Auth header: Authorization: Bearer ${SUPPLIER_API_KEY}
                  ├─ Fetch with retry (exp backoff)
                  │  ├─ Attempt 1: immediate
                  │  ├─ Attempt 2: wait 1s
                  │  ├─ Attempt 3: wait 2s
                  │  └─ Fail: throw error
                  └─ Parse response JSON

                ↓

┌──────────────────────────────┐
│ Raw Supplier JSON            │
│                              │
│ {                            │
│   "success": true,           │
│   "data": [                  │
│     {                        │
│       "sku": "TIRE-205...", │
│       "title": "Michelin...",│
│       "price": 850,          │
│       "cost": 650,           │
│       "stock": 120,          │
│       "attributes": {        │
│         "brand": "Michelin", │
│         "eu_fuel": "B",      │
│         ...                  │
│       }                      │
│     },                       │
│     ...                      │
│   ]                          │
│ }                            │
└──────────────────────────────┘
```

### 2. Rate Limit Handling

```
If Supplier API has rate limit:

Loop iteration:
  ├─ Check: requests_in_last_minute < LIMIT?
  ├─ YES: Make request immediately
  └─ NO:
      ├─ Calculate wait time = (60 / LIMIT) seconds
      ├─ Sleep (wait time)
      └─ Retry
```

### 3. Validation & Error Handling

```
For each product in response:
  ├─ Is JSON valid?
  │  └─ NO: Log error, skip product
  │
  ├─ Required fields present (sku, title, category)?
  │  └─ NO: Log error, skip product
  │
  ├─ Category in [tire, rim, battery]?
  │  └─ NO: Try auto-detect, if fail skip
  │
  ├─ Price >= 0?
  │  └─ NO: Log error, skip product
  │
  ├─ Stock >= 0?
  │  └─ NO: Default to 0
  │
  └─ ✅ Valid: proceed to normalize
```

---

## Title Parsing Flow

### Tire Title Parsing

```
Input: "Michelin Primacy 4 205/55R16 91V"

Regex: /(\d{3})\/(\d{2})R?(\d{2})\s+(\d+)([A-Z])/

Capture Groups:
  $1 = 205  (genişlik)
  $2 = 55   (oran)
  $3 = 16   (jant çapı)
  $4 = 91   (yük indeksi)
  $5 = V    (hız indeksi)

Output:
{
  width: 205,
  ratio: 55,
  diameter: 16,
  loadIndex: 91,
  speedIndex: "V",
  brand: "Michelin",
  model: "Primacy 4"
}

Metafield Mapping:
  width         → lastikGenislik (number_integer)
  ratio         → lastikOran (number_integer)
  diameter      → jantCap (number_decimal)
  loadIndex     → yukIndeksi (number_integer)
  speedIndex    → hizIndeksi (single_line_text_field)
  mevsimTip     → (infer from brand/model)
  euYakit       → (resolve via lookup table)
  euIslakZemin  → (resolve via lookup table)
  euGurultu     → (resolve via lookup table)
```

### Rim Title Parsing

```
Input: "Alminyum Jant 7Jx17 5x112 ET45"

Patterns:
  /(\d+)Jx(\d{2})/  → width x diameter
  /(\d+)x(\d{3})/   → PCD (hole count x diameter)
  /ET(-?\d+)/       → offset/ET value

Output:
{
  width: 7,
  diameter: 17,
  pcd: "5x112",
  offset: 45,
  material: "Alminyum"
}

Metafield Mapping:
  width     → jantGenislik (number_decimal)
  diameter  → jantCap (number_decimal)
  pcd       → jantPCD (single_line_text_field)
  offset    → jantOffset (number_integer)
```

### Battery Title Parsing

```
Input: "Varta Blue Dynamic 60Ah 540A 12V"

Patterns:
  /(\d+)Ah/   → capacity (Amper-hour)
  /(\d+)A\b/  → CCA (Cold Cranking Amps)
  /(\d+)V/    → voltage

Output:
{
  capacity: 60,
  cca: 540,
  voltage: 12,
  brand: "Varta",
  model: "Blue Dynamic"
}

Metafield Mapping:
  capacity  → akuKapasite (number_integer)
  cca       → akuCCA (number_integer)
```

### Error Cases

```
If regex doesn't match:
  ├─ Log warning: "Could not parse: {title}"
  ├─ Check fallback: supplier API has attribute data?
  │  ├─ YES: use attributes
  │  └─ NO: mark as unparseable
  └─ Continue (don't fail sync)
```

---

## Pricing Rules Flow

### 1. Load Rules from Database

```
SELECT * FROM price_rules
WHERE is_active = true
ORDER BY category, priority DESC;

Example result:
[
  {
    id: 1,
    name: "Michelin Premium",
    category: "tire",
    matchField: "brand",
    matchValue: "Michelin",
    percentageMarkup: 0.05,  // +5%
    priority: 10
  },
  {
    id: 2,
    name: "Large Rim",
    category: "rim",
    matchField: "diameter",
    matchValue: "17",
    percentageMarkup: 0.03,  // +3%
    priority: 5
  }
]
```

### 2. Calculate Price for Product

```
Input:
  cost: 650 TL (from supplier)
  category: "tire"
  brand: "Michelin"
  size: "205/55R16"

Step 1: Base markup (category)
  categoryMarkup = settings.get("category_markup_tire")
           = 1.25 (default +25%)

Step 2: Apply additional rules
  matchedRules = [
    { percentageMarkup: 0.05 }   // Michelin brand
  ]

Step 3: Calculate multiplier
  totalMultiplier = 1 +
                    sum(rule.percentageMarkup for each rule)
                = 1 + 0.05
                = 1.05

Step 4: Final price
  finalPrice = cost * categoryMarkup * totalMultiplier
             = 650 * 1.25 * 1.05
             = 853.125 TL
             = 853 TL (rounded)

Output:
{
  originalCost: 650,
  categoryMarkup: 1.25,
  appliedRules: [
    { name: "Michelin Premium", percentageMarkup: 0.05 }
  ],
  finalPrice: 853
}
```

### 3. Rule Matching Logic

```
For each rule in priceRules:
  ├─ Check category: rule.category == product.category?
  │  └─ NO: skip to next rule
  │
  ├─ Get product attribute by rule.matchField:
  │  ├─ matchField: "brand" → use parsed brand
  │  ├─ matchField: "size" → use parsed size
  │  ├─ matchField: "pattern" → use regex match
  │  └─ matchField: other → check metafields
  │
  ├─ Compare: productAttribute matches rule.matchValue?
  │  ├─ Exact match: ✓
  │  ├─ Partial/regex: (configurable)
  │  └─ NO: skip to next rule
  │
  └─ ✅ MATCH: Apply markup & continue
```

### 4. Admin Test UI

```
┌─────────────────────────────────────┐
│ Price Calculator (Dashboard)        │
├─────────────────────────────────────┤
│                                     │
│ Category: [Tire ▼]                 │
│ Cost: [650    ]                    │
│ Brand: [Michelin]                  │
│ Size: [205/55R16]                  │
│                                     │
│ [Calculate] button                 │
│                                     │
├─────────────────────────────────────┤
│ Results:                            │
│                                     │
│ Category Markup: 1.25x (+25%)      │
│ Applied Rules:                      │
│  • Michelin Premium: +5%            │
│                                     │
│ Original (Cost): 650 TL            │
│ Category Applied: 812.5 TL         │
│ Rules Applied: 853.1 TL            │
│ Final Price: 853 TL                │
│                                     │
└─────────────────────────────────────┘
```

---

## Shopify Sync Flow

### 1. Check if Product Exists

```
Input: productMap (SKU + dataHash)

Query database:
  SELECT shopifyId, inventoryItemId, dataHash
  FROM product_map
  WHERE sku = ?

Result:
  ├─ Not found: ACTION = CREATE
  ├─ Found, hash same: ACTION = SKIP
  └─ Found, hash different: ACTION = UPDATE
```

### 2. Create Product (GraphQL)

```graphql
mutation CreateProduct($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      handle
      title
      variants {
        id
        inventoryItem {
          id
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}

Variables:
{
  "input": {
    "title": "Michelin Primacy 4 205/55R16 91V",
    "handle": "michelin-primacy-4-205-55r16-91v",
    "vendor": "Rüzgar Lastik",
    "productType": "Lastik",
    "bodyHtml": "<p>Premium summer tire...</p>",
    "status": "ACTIVE",
    "standardizedProductType": {
      "productTaxonomyNodeId": "..."
    }
  }
}
```

### 3. Update Product (GraphQL)

```graphql
mutation UpdateProduct($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id }
    userErrors { field message }
  }
}

Variables:
{
  "input": {
    "id": "gid://shopify/Product/123456",
    "title": "Michelin Primacy 4 205/55R16 91V (Updated)",
    "bodyHtml": "<p>Updated description...</p>"
  }
}
```

### 4. Add Metafields

```graphql
mutation SetMetafields($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id }
    userErrors { field message }
  }
}

Variables:
{
  "input": {
    "id": "gid://shopify/Product/123456",
    "metafields": [
      {
        "namespace": "custom",
        "key": "lastikGenislik",
        "type": "number_integer",
        "value": "205"
      },
      {
        "namespace": "custom",
        "key": "mevsimTip",
        "type": "single_line_text_field",
        "value": "yaz"
      },
      {
        "namespace": "custom",
        "key": "euYakit",
        "type": "single_line_text_field",
        "value": "B"
      }
      // ... more metafields
    ]
  }
}
```

### 5. Update Inventory

```graphql
mutation SetInventoryQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryItems {
      id
      quantities {
        quantity
        location { id }
      }
    }
    userErrors {
      field
      message
    }
  }
}

Variables:
{
  "input": {
    "reason": "Supplier sync",
    "quantities": [
      {
        "inventoryItemId": "gid://shopify/InventoryItem/789",
        "availableQuantity": 120,
        "locationId": "gid://shopify/Location/12345678"
      }
    ]
  }
}
```

### 6. Rate Limit & Retry Logic

```
Cost estimation:
  - productCreate: ~20 points
  - productUpdate: ~10 points
  - metafield set: ~5 points each (x9 for tire)
  - inventory set: ~5 points

Total per tire: ~65 points

Shopify limits:
  - Max: 2000 points
  - Restore: 100 points/sec

Example flow:
  Batch 1 (10 products):
    ├─ Cost: 10 * 65 = 650 points
    ├─ Remaining: 2000 - 650 = 1350
    ├─ Can continue? YES
    └─ Execute

  Batch 2 (10 products):
    ├─ Cost: 10 * 65 = 650 points
    ├─ Remaining: 1350 - 650 = 700
    ├─ Can continue? YES
    └─ Execute

  Batch 3 (10 products):
    ├─ Cost: 10 * 65 = 650 points
    ├─ Remaining: 700 - 650 = 50 (CRITICAL)
    ├─ Next batch would exceed: 50 < 650
    ├─ Action: WAIT
    │  ├─ Calculate restore time: 650 / 100 = 6.5 seconds
    │  └─ Sleep 6.5 seconds
    ├─ After wait: 50 + (6.5 * 100) = 700 points
    ├─ Now can execute (700 > 650)
    └─ Execute

  On API error (code 429 - Too Many Requests):
    ├─ Attempt 1: Wait 1s, retry
    ├─ Attempt 2: Wait 2s, retry
    ├─ Attempt 3: Wait 4s, retry
    └─ Fail: Log error, mark product failed
```

---

## Error Handling Flow

### Error Detection & Recovery

```
Try-Catch Wrapper (per product):

  try {
    1. Fetch supplier
    2. Parse & normalize
    3. Calculate price
    4. Check if exists (DB query)
    5. Shopify create/update
    6. Set metafields
    7. Update inventory
    8. Update DB (hash, lastSyncAt)
  }
  catch (error) {
    ├─ Identify error type:
    │  ├─ Network error?
    │  │  ├─ YES: Retry (exp backoff)
    │  │  └─ After max retries: FAILED
    │  ├─ Validation error?
    │  │  ├─ YES: Log, SKIP
    │  │  └─ Don't retry
    │  ├─ Shopify API error?
    │  │  ├─ Type: rate_limit
    │  │  │  └─ Backoff, retry
    │  │  ├─ Type: invalid_data
    │  │  │  └─ Log, SKIP
    │  │  └─ Type: auth
    │  │     └─ STOP entire sync
    │  └─ Unknown error?
    │     └─ Log stack trace, SKIP
    │
    ├─ Record in sync_items table:
    │  ├─ sku
    │  ├─ action: "error"
    │  ├─ message: error description
    │  └─ details: full error object
    │
    └─ Continue to next product (graceful)
```

### Partial Success Marking

```
After all products processed:

  if (failed_count == 0) {
    session.status = "success"
  } else if (failed_count < total * 0.1) {
    session.status = "partial"  // < 10% failure acceptable
  } else {
    session.status = "failed"   // > 10% failure
  }
```

---

## Admin Dashboard Interaction

### Manual Sync Trigger Flow

```
┌──────────────────────────────────┐
│ Admin Dashboard                  │
│ /sync page                       │
├──────────────────────────────────┤
│                                  │
│ Categories: [✓Tire ✓Rim ✗Bat]  │
│ Limit: [500]                    │
│ Mode: [Incremental ▼]           │
│ Dry Run: [✓]                    │
│                                  │
│ [Start Sync] button              │
└────────────┬─────────────────────┘
             │
             │ tRPC call:
             │ syncRouter.start({
             │   categories: ["tire", "rim"],
             │   limit: 500,
             │   mode: "incremental",
             │   dryRun: true
             │ })
             ↓
        ┌────────────────────┐
        │ Backend (Hono)     │
        │ Sync Orchestrator  │
        │ (starts job)       │
        └────────────────────┘
             │
             │ Returns: SyncSession {
             │   id: "abc-123",
             │   status: "running"
             │ }
             ↓
┌──────────────────────────────────┐
│ Dashboard Progress UI            │
│                                  │
│ ⏳ Syncing...                     │
│ [████████░░░░░░░░] 40%          │
│                                  │
│ Processed: 200 / 500            │
│ Created: 80                      │
│ Updated: 120                     │
│ Failed: 0                        │
│                                  │
│ Live Logs:                       │
│ ├─ [✓] SKU123: CREATED          │
│ ├─ [✓] SKU124: UPDATED          │
│ ├─ [⚠] SKU125: SKIPPED (hash)   │
│ └─ [•] SKU126: PROCESSING...    │
│                                  │
│ [Cancel Sync] button             │
└──────────────────────────────────┘
```

### Pricing Rules CRUD Flow

```
View Rules:
  GET /api/trpc/priceRules.list
  → Display table with all rules

Create Rule:
  POST /api/trpc/priceRules.create
  Body: {
    name: "Michelin Premium",
    category: "tire",
    matchField: "brand",
    matchValue: "Michelin",
    percentageMarkup: 0.05
  }
  → Add to DB, refresh table

Edit Rule:
  POST /api/trpc/priceRules.update
  Body: { ...rule, percentageMarkup: 0.10 }
  → Update DB, refresh table

Delete Rule:
  POST /api/trpc/priceRules.delete
  Body: { id: 1 }
  → Delete from DB, refresh table

Test Calculation:
  POST /api/trpc/priceRules.testPrice
  Body: {
    cost: 650,
    category: "tire",
    brand: "Michelin"
  }
  → Return { finalPrice: 853 }
  → Show in modal before saving
```

---

## Summary

✅ **All flows documented** with ASCII diagrams  
✅ **Error handling** at each layer  
✅ **Rate limiting** strategy clear  
✅ **Admin interaction** flows defined  
✅ **Database transaction** points marked  

🚀 **Next:** env-config.md (environment & settings)
