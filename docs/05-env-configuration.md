# 05 - Environment Variables & Configuration Guide

## 📋 İçindekiler

1. [Environment Files Structure](#environment-files-structure)
2. [Backend Environment (.env)](#backend-environment-env)
3. [Frontend Environment (.env)](#frontend-environment-env-1)
4. [Database Configuration](#database-configuration)
5. [Shopify Configuration](#shopify-configuration)
6. [Supplier API Configuration](#supplier-api-configuration)
7. [Sync Configuration](#sync-configuration)
8. [Better Auth Configuration](#better-auth-configuration)
9. [Settings Database Table](#settings-database-table)
10. [Deployment Environment Variables](#deployment-environment-variables)
11. [Troubleshooting & Validation](#troubleshooting--validation)

---

## Environment Files Structure

### Repository Layout

```
ruzgar-lastik-sync/
├─ .env                    # ← LOCAL DEVELOPMENT (git-ignored)
├─ .env.example           # ← Template (commit this)
├─ .env.production        # ← Production (Vercel secrets)
├─ apps/
│  ├─ server/
│  │  ├─ .env.local       # ← Server specific (optional)
│  │  └─ .env.production  # ← Server production (Vercel)
│  └─ web/
│     ├─ .env.local       # ← Web specific (optional)
│     └─ .env.production  # ← Web production (Vercel)
├─ packages/
│  └─ db/
│     └─ .env.local       # ← Database (DATABASE_URL)
└─ .gitignore
   # *.env
   # *.env.local
   # .env.*.local
```

**Golden Rule:** `.gitignore` içinde `.env*` olmalı, asla commit etme!

---

## Backend Environment (.env)

### Location: `apps/server/.env`

```bash
# ============================================
# SHOPIFY CONFIGURATION
# ============================================

SHOPIFY_SHOP_DOMAIN=tgsqxx-gb.myshopify.com
# Shopify admin URL'sinin domain kısmı
# Format: {store-name}.myshopify.com
# Testten sonra bul ve yaz

SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
# Shopify Admin API access token
# Generate: Shopify Admin → Settings → Apps and sales channels → Develop apps
# Permissions needed:
#   - read_products, write_products
#   - read_inventory, write_inventory
#   - read_metaobjects, write_metaobjects (optional)

SHOPIFY_API_VERSION=2024-10
# Shopify API version (stable)
# Check: https://shopify.dev/api/admin-rest/2024-10

SHOPIFY_LOCATION_ID=gid://shopify/Location/12345678
# Default location for inventory
# Find via: npm run verify:location-id
# Or manually from Shopify Admin → Settings → Locations

# ============================================
# SUPPLIER API CONFIGURATION
# ============================================

USE_MOCK_SUPPLIER=true
# true = use mock JSON data (development)
# false = use real supplier API

SUPPLIER_API_URL=https://api.supplier.com/v1/products
# Real supplier API endpoint
# Only needed if USE_MOCK_SUPPLIER=false

SUPPLIER_API_KEY=supplier_key_xxxxxxxx
# Authentication key for supplier API
# Ask from supplier

SUPPLIER_API_TIMEOUT=30000
# Timeout in milliseconds (30 seconds)

# ============================================
# DATABASE CONFIGURATION
# ============================================

DATABASE_URL=postgresql://user:password@db.neon.tech/dbname
# Neon PostgreSQL connection string
# Get from: https://console.neon.tech/
# Format: postgresql://[user][:password]@[host][:port]/[database]
# Keep connection pooling ON (Neon default)

# ============================================
# SYNC ENGINE CONFIGURATION
# ============================================

SYNC_BATCH_SIZE=50
# Products per batch
# Range: 10-200
# Higher = faster but more rate limit risk
# Recommendation: 50 (balanced)

SYNC_CONCURRENCY=5
# Parallel operations
# Range: 1-10
# Recommendation: 5 (Shopify API friendly)

MAX_RETRIES=3
# Retry attempts per failed product
# Exponential backoff: 1s, 2s, 4s

SYNC_MODE=incremental
# incremental = only changed products (hash diff)
# full = all products (slower but thorough)

SYNC_CATEGORIES=tire,rim,battery
# Categories to sync
# Comma-separated: tire, rim, battery
# Or: all (default)

SYNC_MIN_STOCK=0
# Skip products with stock < this value
# 0 = include all

SYNC_ONLY_IN_STOCK=false
# true = skip if stock == 0
# false = sync regardless

# ============================================
# SYNC RULES (What gets synced)
# ============================================

SYNC_CREATE_NEW=true
# Create products in Shopify that don't exist

SYNC_UPDATE_EXISTING=true
# Update products that already exist

SYNC_UPDATE_PRICES=true
# Update product prices

SYNC_UPDATE_INVENTORY=true
# Update inventory quantities

SYNC_UPDATE_METAFIELDS=true
# Update metafields (tire specs, EU labels, etc.)

# ============================================
# MONITORING & LOGGING
# ============================================

LOG_LEVEL=info
# off, error, warn, info, debug, trace
# Production: info
# Development: debug

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
# (Optional) Slack notifications on sync complete
# Leave empty to disable
# Get from: https://api.slack.com/messaging/webhooks

# ============================================
# BETTER AUTH (Authentication)
# ============================================

BETTER_AUTH_SECRET=generated_secret_key_min_32_chars
# Generate: openssl rand -base64 32
# Used for session signing

BETTER_AUTH_URL=http://localhost:3000
# Backend URL for auth callbacks
# Local: http://localhost:3000
# Production: https://yourdomain.com

# ============================================
# DEVELOPMENT ONLY
# ============================================

NODE_ENV=development
# development, production, test

DEBUG=*
# Enable debug logs (optional)

PORT=3001
# Server port (if not using Hono defaults)
```

### Example `.env.example`

```bash
# Copy this to .env and fill in actual values

SHOPIFY_SHOP_DOMAIN=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_VERSION=2024-10
SHOPIFY_LOCATION_ID=

USE_MOCK_SUPPLIER=true
SUPPLIER_API_URL=
SUPPLIER_API_KEY=
SUPPLIER_API_TIMEOUT=30000

DATABASE_URL=

SYNC_BATCH_SIZE=50
SYNC_CONCURRENCY=5
MAX_RETRIES=3
SYNC_MODE=incremental
SYNC_CATEGORIES=tire,rim,battery
SYNC_MIN_STOCK=0
SYNC_ONLY_IN_STOCK=false

SYNC_CREATE_NEW=true
SYNC_UPDATE_EXISTING=true
SYNC_UPDATE_PRICES=true
SYNC_UPDATE_INVENTORY=true
SYNC_UPDATE_METAFIELDS=true

LOG_LEVEL=info
SLACK_WEBHOOK_URL=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

NODE_ENV=development
```

---

## Frontend Environment (.env)

### Location: `apps/web/.env`

```bash
# ============================================
# NEXT.JS PUBLIC VARIABLES
# ============================================
# NOTE: Prefix with NEXT_PUBLIC_ to expose to browser

NEXT_PUBLIC_APP_URL=http://localhost:3000
# Frontend URL
# Local: http://localhost:3000
# Production: https://yourdomain.com

NEXT_PUBLIC_API_URL=http://localhost:3001
# Backend (Hono server) URL
# Local: http://localhost:3001
# Production: https://api.yourdomain.com

# ============================================
# NEXT.JS PRIVATE VARIABLES (Server-side only)
# ============================================

BETTER_AUTH_SECRET=same_as_backend
# Must match backend BETTER_AUTH_SECRET

BETTER_AUTH_URL=http://localhost:3000
# Must match backend BETTER_AUTH_URL

# ============================================
# VERCEL DEPLOYMENT
# ============================================

VERCEL_ENV=development
# Set automatically by Vercel (development, preview, production)
```

---

## Database Configuration

### Neon PostgreSQL Setup

1. **Account Creation**
   - Go: https://console.neon.tech/
   - Sign up with GitHub/Google
   - Create project: `ruzgar-lastik-sync`

2. **Connection String**
   - Project → Connection string
   - Format: `postgresql://[user]:[password]@[host]/[database]`
   - Copy to `.env` as `DATABASE_URL`

3. **Connection Pooling**
   ```
   # Default endpoint supports pooling
   Use: [hostname]-pooler.postgres.vercel-storage.com
   This handles 1000s of connections
   ```

4. **Drizzle Configuration**
   ```typescript
   // packages/db/drizzle.config.ts
   
   export default {
     schema: './schema.ts',
     out: './migrations',
     driver: 'postgresql',
     dbCredentials: {
       url: process.env.DATABASE_URL!,
     },
   };
   ```

5. **Migrations**
   ```bash
   # Generate migration
   bun db:generate
   
   # Apply migration
   bun db:push
   
   # View migrations
   ls packages/db/migrations/
   ```

---

## Shopify Configuration

### Step 1: Get Credentials

**Location ID:**
```bash
# Run test to find Location ID
npm run verify:location-id

# Output:
# Location ID: gid://shopify/Location/12345678
# Name: Rüzgar Lastik - Ana Depo
```

**Access Token:**
```bash
# 1. Shopify Admin → Settings → Apps and sales channels → Develop apps
# 2. Create app: "Rüzgar Lastik Sync"
# 3. Admin API credentials → Install app
# 4. Generate access token
# 5. Copy token (appears once!) to .env
```

**Required Scopes:**
```
write_products
read_products
write_inventory
read_inventory
read_metaobjects
write_metaobjects
```

### Step 2: Verify Configuration

```bash
# Test Shopify connection
npm run verify:shopify

# Success output:
# ✅ Shop: Rüzgar Lastik
# ✅ Domain: tgsqxx-gb.myshopify.com
# ✅ Plan: Shopify Plus
# ✅ Location: gid://shopify/Location/12345678
# ✅ Metafield definitions: 16/16 (ready)
```

---

## Supplier API Configuration

### Mock Supplier (Development)

```bash
# .env
USE_MOCK_SUPPLIER=true
```

Mock data location: `apps/server/data/mock-products.json`

Example:
```json
{
  "success": true,
  "data": [
    {
      "sku": "TIRE-205-55R16-MICHELIN",
      "title": "Michelin Primacy 4 205/55R16 91V",
      "category": "tire",
      "price": 850,
      "cost": 650,
      "stock": 120,
      "attributes": {
        "brand": "Michelin",
        "eu_fuel": "B",
        "eu_wet": "B",
        "eu_noise": 71
      }
    }
  ]
}
```

### Real Supplier API (Production)

```bash
# .env
USE_MOCK_SUPPLIER=false
SUPPLIER_API_URL=https://api.supplier.com/v1/products
SUPPLIER_API_KEY=your_api_key_here
SUPPLIER_API_TIMEOUT=30000
```

**Expected Response Format:**

```typescript
interface SupplierResponse {
  success: boolean;
  data: Array<{
    sku: string;
    title: string;
    category: "tire" | "rim" | "battery";
    price?: number;
    cost: number;
    stock: number;
    attributes?: Record<string, unknown>;
    images?: Array<{ src: string; alt?: string }>;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

---

## Sync Configuration

### Default Values (Override via .env or Dashboard)

| Setting | Default | Min | Max | Type |
|---------|---------|-----|-----|------|
| SYNC_BATCH_SIZE | 50 | 10 | 200 | integer |
| SYNC_CONCURRENCY | 5 | 1 | 10 | integer |
| MAX_RETRIES | 3 | 1 | 5 | integer |
| SYNC_MODE | incremental | - | - | enum |
| SYNC_MIN_STOCK | 0 | 0 | 999999 | integer |

### Category Markup (Default Pricing)

| Category | Default Markup | Configurable? |
|----------|---|---|
| tire | +25% (1.25x) | ✅ Yes (dashboard) |
| rim | +20% (1.20x) | ✅ Yes (dashboard) |
| battery | +18% (1.18x) | ✅ Yes (dashboard) |

**Override via Dashboard:**
- `/dashboard/pricing-rules`
- Create category-specific rules
- Stored in `price_rules` table

---

## Better Auth Configuration

### Generate Secret

```bash
# Generate 32+ char random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Add to .env
BETTER_AUTH_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Session Storage

By default, Better Auth uses:
- **Local Development:** In-memory (fast, loses on restart)
- **Production:** Database (persists)

### Configure Database Session

```typescript
// apps/server/auth.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@packages/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "postgres",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    // Additional plugins if needed
  ],
});
```

---

## Settings Database Table

### Runtime Configuration (Changeable without restart)

Stored in `settings` table (key-value store):

```typescript
// apps/server/services/settingsService.ts

export class SettingsService {
  async get(key: string): Promise<string | null> {
    const result = await db.query.settings.findFirst({
      where: (s) => eq(s.key, key),
    });
    return result?.value ?? null;
  }

  async set(key: string, value: string | number | boolean): Promise<void> {
    await db.insert(settings).values({
      key,
      value: String(value),
    }).onConflict(sql`(key)`).doUpdate({
      set: { value: String(value) },
    });
  }
}
```

### Available Settings

| Key | Type | Default | Use |
|-----|------|---------|-----|
| `category_markup_tire` | number | 1.25 | Tire base markup |
| `category_markup_rim` | number | 1.20 | Rim base markup |
| `category_markup_battery` | number | 1.18 | Battery base markup |
| `batch_size` | integer | 50 | Sync batch size |
| `sync_concurrency` | integer | 5 | Parallel operations |
| `max_retries` | integer | 3 | Retry attempts |
| `last_sync_at` | timestamp | - | Last successful sync |
| `sync_enabled` | boolean | true | Enable/disable auto sync |

### Update Settings (Admin API)

```typescript
// tRPC procedure
router.mutation('updateSetting', async (input: { key: string; value: unknown }) => {
  await settingsService.set(input.key, input.value);
  return { success: true };
});
```

---

## Deployment Environment Variables

### Vercel Deployment

**Set variables via Vercel Dashboard:**

1. Go: https://vercel.com/dashboard
2. Select project: `ruzgar-lastik-sync`
3. Settings → Environment Variables
4. Add all `.env` variables

**Distinction:**

```
Development (local):   .env
Preview (branches):    Environment Variables + Preview overrides
Production (main):     Environment Variables (prod-specific)
```

### Example Production Config

```bash
# Production .env (Vercel)

SHOPIFY_SHOP_DOMAIN=tgsqxx-gb.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_prod_xxxxx  # Different token per environment
SHOPIFY_LOCATION_ID=gid://shopify/Location/...

DATABASE_URL=postgresql://prod_user:prod_pass@prod.neon.tech/prod_db
# Neon automatically provides pooled connection

USE_MOCK_SUPPLIER=false
SUPPLIER_API_URL=https://api.supplier.com/v1
SUPPLIER_API_KEY=prod_api_key_xxxxx

BETTER_AUTH_SECRET=prod_secret_xxxxx
BETTER_AUTH_URL=https://ruzgarlastik-sync.vercel.app

NEXT_PUBLIC_APP_URL=https://ruzgarlastik-sync.vercel.app
NEXT_PUBLIC_API_URL=https://ruzgarlastik-sync-api.vercel.app

NODE_ENV=production
LOG_LEVEL=info
```

---

## Troubleshooting & Validation

### ❌ Error: "SHOPIFY_ACCESS_TOKEN not found"

```bash
Solution:
1. Check .env file exists in project root
2. Restart dev server: bun run dev
3. Regenerate token from Shopify Admin
```

### ❌ Error: "DATABASE_URL not set"

```bash
Solution:
1. Create Neon project: https://console.neon.tech/
2. Copy connection string
3. Add to .env: DATABASE_URL=...
4. Run: bun db:push
```

### ❌ Error: "Location ID not found"

```bash
Solution:
1. Run: npm run verify:location-id
2. Copy output
3. Add to .env: SHOPIFY_LOCATION_ID=...
4. Restart server
```

### ❌ Error: "Rate limit exceeded"

```bash
Solution:
1. Lower SYNC_BATCH_SIZE (50 → 25)
2. Lower SYNC_CONCURRENCY (5 → 3)
3. Increase MAX_RETRIES: 3 → 5
4. Check Shopify API usage: Admin → Analytics → APIs
```

### ✅ Validation Checklist

```bash
# Before deploying to production:

npm run verify:shopify
# ✅ All Shopify credentials valid

npm run verify:supplier
# ✅ Supplier API (mock or real) working

npm run verify:database
# ✅ Neon connection successful

npm run test
# ✅ All tests passing

npm run build
# ✅ Both frontend & backend compile

# Then:
git push origin main
# → Vercel auto-deploys
```

---

## Summary

✅ **Environment files** structured and documented  
✅ **All required variables** explained with examples  
✅ **Defaults** set and overrideable  
✅ **Validation** scripts ready  
✅ **Deployment** configuration clear  

---

## İlgili Dökümanlar

| Döküman | İçerik |
|---------|--------|
| `06-environment-setup.md` | **Adım adım kurulum rehberi** - Neon, Shopify, Better Auth |
| `07-troubleshooting.md` | **Hata çözümleri** - Yaşanan sorunlar ve çözümleri |

---

🚀 **Ready to code!** Environment sorunları için `07-troubleshooting.md` dosyasına bakın.
