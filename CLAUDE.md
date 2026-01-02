# CLAUDE.md - Ruzgar Lastik Sync Project

This file provides guidance for Claude Code instances working in this repository.

## Project Overview

**Ruzgar Lastik Sync** is a Shopify product synchronization system for a Turkish tire/rim/battery e-commerce business. It bridges supplier APIs with a Shopify store, handling automatic product creation, pricing rules, metafield mapping, and inventory management.

### Tech Stack (Better-T-Stack)
- **Runtime**: Bun (4x faster than Node.js)
- **Monorepo**: Turborepo
- **Backend**: Hono (lightweight HTTP framework)
- **Frontend**: Next.js
- **API**: tRPC (type-safe)
- **Database**: Drizzle ORM + Neon PostgreSQL
- **Auth**: Better Auth

## Quick Commands

```bash
# Development
bun install              # Install dependencies
bun dev                  # Start all apps (turbo)
bun dev:web              # Start frontend only
bun dev:server           # Start backend only

# Database
bun db:push              # Push schema to Neon
bun db:studio            # Open Drizzle Studio
bun db:generate          # Generate migrations
bun db:migrate           # Run migrations

# Quality
bun run check-types      # TypeScript check across all packages
bun run build            # Build all packages

# Sync (CLI)
bun run apps/server/src/scripts/sync.ts --mode full --dry-run true
```

## Architecture

```
ruzgarlastik-prd-sync/
├── apps/
│   ├── web/                 # Next.js admin dashboard
│   │   └── src/app/dashboard/
│   │       ├── page.tsx           # Overview
│   │       ├── sync/              # Sync pipeline UI
│   │       ├── pricing-rules/     # Fiyat kuralları
│   │       ├── products/          # Ürün listesi
│   │       ├── supplier/          # Tedarikçi ürünleri
│   │       ├── settings/          # Ayarlar
│   │       └── logs/              # Sync logları
│   └── server/              # Hono backend
│       └── src/
│           ├── services/    # Core business logic (14 servis)
│           │   ├── syncOrchestrator.ts      # Main sync coordination
│           │   ├── shopifyService.ts        # Shopify GraphQL client
│           │   ├── supplierService.ts       # Supplier API integration
│           │   ├── supplierProductService.ts # Kalıcı ürün deposu
│           │   ├── titleParserService.ts    # Product title parsing
│           │   ├── pricingRulesService.ts   # Price calculations
│           │   ├── metafieldUtils.ts        # Metafield type coercion
│           │   ├── rateLimiter.ts           # Shopify rate limiting
│           │   ├── retryUtils.ts            # Exponential backoff retry
│           │   ├── cacheService.ts          # Ürün cache yönetimi
│           │   ├── validationService.ts     # Ürün validasyonu
│           │   ├── fetchJobService.ts       # Supplier fetch job'ları
│           │   └── jobSchedulerService.ts   # Otomatik retry scheduler
│           └── scripts/
│               ├── sync.ts              # CLI sync script
│               ├── validate-and-sync.ts # Validation + sync
│               └── check-sync-status.ts # Durum kontrol
├── packages/
│   ├── api/                 # tRPC router definitions
│   │   └── src/routers/
│   │       ├── sync.ts              # Sync endpoints
│   │       ├── products.ts          # Product endpoints
│   │       ├── priceRules.ts        # Pricing endpoints
│   │       ├── settings.ts          # Settings endpoints
│   │       └── supplierProducts.ts  # Supplier product endpoints
│   ├── db/                  # Drizzle schema & migrations
│   │   └── src/schema/
│   │       ├── product.ts    # productMap, syncSessions, syncItems
│   │       ├── pricing.ts    # pricingRules
│   │       ├── settings.ts   # settings
│   │       ├── cache.ts      # productsCache, cacheMetadata
│   │       ├── supplier.ts   # supplierProducts, fetchJobs, history
│   │       └── auth.ts       # Better Auth tables
│   ├── auth/                # Better Auth config
│   └── config/              # Shared TypeScript types
└── docs/                    # Project documentation (7 dosya)
```

## Key Services

### SyncOrchestrator (`apps/server/src/services/syncOrchestrator.ts`)
Coordinates the full sync flow: fetch supplier products → parse titles → apply pricing → sync to Shopify.

### ShopifyService (`apps/server/src/services/shopifyService.ts`)
GraphQL client for Shopify Admin API with:
- Rate limiting (2000 points max, 100 points/sec restore)
- Automatic retry with exponential backoff
- Product CRUD, variant updates, inventory management, metafield operations

### MetafieldUtils (`apps/server/src/services/metafieldUtils.ts`)
Handles Shopify metafield type coercion with Zod validation. Supports: `single_line_text_field`, `number_integer`, `number_decimal`, `boolean`, `json`, `list.single_line_text_field`, `date`, `date_time`.

### TitleParserService (`apps/server/src/services/titleParserService.ts`)
Extracts structured data from product titles:
- Tire: `"Michelin Primacy 4 205/55R16 91V"` → width, ratio, diameter, speed index
- Rim: `"7Jx17 5x112 ET45"` → width, PCD, offset
- Battery: `"Varta Blue Dynamic 60Ah 540A"` → capacity, CCA

## Database Schema

Key tables in `packages/db/src/schema/`:

**Core Tables:**
- `syncSessions`: Sync job tracking (status, stats, timing)
- `syncItems`: Individual product sync results per session
- `productMap`: SKU to Shopify product ID mapping
- `pricingRules`: Category/brand-based pricing rules
- `settings`: Key-value configuration store

**Cache Tables:**
- `productsCache`: Cached supplier products (geçici)
- `cacheMetadata`: Cache freshness tracking

**Supplier Tables (Yeni):**
- `supplierProducts`: Kalıcı ürün deposu (SKU, fiyat, stok, validasyon durumu)
- `supplierProductHistory`: Fiyat/stok değişiklik geçmişi
- `fetchJobs`: Supplier fetch job state machine (rate limit retry)
- `validationSettings`: Validasyon konfigürasyonu

## Environment Variables

⚠️ **ÖNEMLİ:** Detaylı kurulum için `docs/06-environment-setup.md` dosyasına bakın!

### apps/server/.env
```bash
# Database (Neon PostgreSQL - https://console.neon.tech)
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require

# Better Auth (Secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
BETTER_AUTH_SECRET=min-32-karakter-secret
BETTER_AUTH_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:3000

# Shopify (Admin → Settings → Apps → Develop apps)
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_LOCATION_ID=gid://shopify/Location/xxxxx
SHOPIFY_API_VERSION=2024-10

# Supplier
USE_MOCK_SUPPLIER=true
PORT=5000
```

### apps/web/.env
```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:5000
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=ayni-secret-backend-ile
BETTER_AUTH_URL=http://localhost:5000
```

## Critical Patterns

### 1. Shopify Rate Limiting
The GraphQL API uses a cost-based rate limiter (not request count). Always use estimated costs:
```typescript
await this.graphql(query, variables, ESTIMATED_COSTS.createProduct);
```

### 2. Metafield Type Consistency
Shopify requires consistent metafield types. Always use `coerceMetafieldValue()` before sending:
```typescript
import { coerceMetafieldValue } from "./metafieldUtils";
const value = coerceMetafieldValue(rawValue, "number_integer");
```

### 3. Retry Logic
All Shopify API calls are wrapped with retry logic. Retryable errors include:
- Rate limiting (throttled)
- Network errors (timeout, ECONNRESET)
- 5xx server errors

### 4. Product Categories
Three product types with different metafield schemas:
- `tire`: lastikGenislik, lastikOran, jantCap, mevsimTip, hizIndeksi, etc.
- `rim`: jantGenislik, jantPCD, jantOffset, jantCap
- `battery`: akuKapasite, akuCCA

## Common Tasks

### Add a new metafield
1. Add to `METAFIELD_DEFINITIONS` in `metafieldUtils.ts`
2. Update title parser if it can be extracted from titles
3. Test with `--dry-run true`

### Debug sync issues
1. Check `syncSessions` table for session status and errors
2. Check `syncItems` for individual product results
3. Run with `DEBUG=true` env var for verbose logging

### Test Shopify connection
Use the `preview` mutation in tRPC to test without writing to Shopify:
```typescript
await trpc.sync.preview.mutate({ categories: ["tire"], dryRun: true });
```

## Testing

```bash
# Run type checks (includes all packages)
bun run check-types

# Run with mock supplier data
USE_MOCK_SUPPLIER=true bun dev:server
```

## CI/CD

- `.github/workflows/ci.yml`: Runs lint, typecheck, build, test on PRs
- `.github/workflows/sync-cron.yml`: Daily sync at 02:00 UTC

## Documentation

Detaylı dökümantasyon `docs/` klasöründe:

| Dosya | İçerik |
|-------|--------|
| `01-claude-context.md` | Proje özeti, eski sistemden öğrenilenler |
| `02-prd-detailed.md` | Detaylı PRD, functional requirements |
| `03-metafields-reference.md` | Tüm metafield şemaları (tire/rim/battery) |
| `04-flows-architecture.md` | Data flow diyagramları, sync akışı |
| `05-env-configuration.md` | Environment değişkenleri (eski) |
| `06-environment-setup.md` | **Kurulum rehberi - Nereden ne alınır** |
| `07-troubleshooting.md` | **Hata çözümleri ve yaşanan sorunlar** |
| `ADMIN_CREDENTIALS.md` | Development admin hesap bilgileri |

## First Time Setup

```bash
# 1. Bağımlılıkları kur
bun install

# 2. .env dosyalarını oluştur (docs/06-environment-setup.md'ye bak)
# apps/server/.env ve apps/web/.env

# 3. Database'i hazırla
bun db:push

# 4. Sistemi başlat
bun dev

# 5. Login (http://localhost:3000/login)
# Email: admin@ruzgarlastik.com
# Password: RuzgarLastik2024!
```
