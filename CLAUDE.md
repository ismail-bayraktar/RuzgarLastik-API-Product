# CLAUDE.md - Ruzgar Lastik Sync Project

This file provides guidance for Claude Code instances working in this repository.

## Project Overview

**Ruzgar Lastik Sync** is a Shopify product synchronization system for a Turkish tire/rim/battery e-commerce business. It bridges supplier APIs with a Shopify store, handling automatic product creation, pricing rules, metafield mapping, and inventory management.

### Tech Stack (Better-T-Stack)
- **Runtime**: Bun (4x faster than Node.js)
- **Monorepo**: Turborepo
- **Unified App**: Next.js (Frontend) + API Routes (Backend adapter for Hono)
- **API**: tRPC (type-safe)
- **Database**: Drizzle ORM + Neon PostgreSQL
- **Auth**: Better Auth

## Quick Commands

```bash
# Development
bun install              # Install dependencies
bun dev                  # Start unified app (Next.js)

# Database
bun db:push              # Push schema to Neon
bun db:studio            # Open Drizzle Studio
bun db:generate          # Generate migrations
bun db:migrate           # Run migrations

# Quality
bun run check-types      # TypeScript check across all packages
bun run build            # Build all packages

# CLI Tools (Scripts)
# Run ingestion (fetch from supplier -> raw DB)
bun run apps/web/scripts/ingest.ts

# Run processing (raw DB -> valid products)
bun run apps/web/scripts/process.ts

# Run sync (valid products -> Shopify)
bun run apps/web/scripts/sync.ts --mode full --dry-run true
```

## Architecture

```
ruzgarlastik-prd-sync/
├── apps/
│   ├── web/                 # Unified Next.js Application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/trpc/[trpc]/  # tRPC API Endpoint
│   │   │   │   ├── api/auth/         # Better Auth Endpoint
│   │   │   │   └── dashboard/        # Admin UI Pages
│   │   │   ├── services/    # Core business logic (Unified Backend Logic)
│   │   │   │   ├── syncOrchestrator.ts
│   │   │   │   ├── shopifyService.ts
│   │   │   │   ├── supplierService.ts
│   │   │   │   └── ... (other services)
│   │   │   └── server/      # tRPC Routers
│   │   │       └── routers/
│   │   │           ├── sync.ts
│   │   │           └── ...
│   │   └── scripts/         # CLI Automation Scripts
│   │       ├── ingest.ts
│   │       ├── process.ts
│   │       ├── sync.ts
│   │       └── pipeline.ts
├── packages/
│   ├── db/                  # Drizzle schema & migrations
│   ├── auth/                # Better Auth config
│   └── config/              # Shared TypeScript types
└── docs/                    # Project documentation (7 dosya)
```

## Key Services (apps/web/src/services/)

### SyncOrchestrator
Coordinates the full sync flow: fetch supplier products → parse titles → apply pricing → sync to Shopify.

### ShopifyService
GraphQL client for Shopify Admin API with rate limiting and automatic retry.

### TitleParserService
Extracts structured data from product titles (Tire/Rim/Battery).

## Database Schema

Key tables in `packages/db/src/schema/`:

- `syncSessions`: Sync job tracking
- `productMap`: SKU to Shopify product ID mapping
- `supplierProducts`: Raw and processed supplier data
- `pricingRules`: Dynamic pricing logic

## Environment Variables

⚠️ **ÖNEMLİ:** Detaylı kurulum için `docs/06-environment-setup.md` dosyasına bakın!

### apps/web/.env.local (Unified)
```bash
# Database
DATABASE_URL=postgresql://...

# Auth
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000

# Shopify
SHOPIFY_SHOP_DOMAIN=...
SHOPIFY_ACCESS_TOKEN=...

# Public
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Critical Patterns

### 1. Shopify Rate Limiting
The GraphQL API uses a cost-based rate limiter. Always use `rateLimiter.ts` service.

### 2. Ingest-Process-Sync Pipeline
The sync process is decoupled:
1. **Ingest**: Fetch JSON from supplier -> Save to `supplier_products` (raw).
2. **Process**: Parse titles, normalize data, apply pricing -> Update `supplier_products` (processed).
3. **Sync**: Push valid/changed products to Shopify.

## Documentation

| Dosya | İçerik |
|-------|--------|
| `01-claude-context.md` | Proje özeti, mimari |
| `06-environment-setup.md` | **Kurulum rehberi** |
| `07-troubleshooting.md` | **Hata çözümleri** |

## First Time Setup

```bash
# 1. Install
bun install

# 2. Configure .env.local in apps/web/
# See docs/06-environment-setup.md

# 3. DB Setup
bun db:push

# 4. Start
bun dev
```
