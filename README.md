# Ruzgar Lastik Sync

This project is a unified Next.js application for syncing products from supplier APIs to Shopify, including a dashboard for management.
Built with the [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack).

## Architecture

- **Unified Application:** Both Frontend (Dashboard) and Backend (API/Workers) run within `apps/web`.
- **Framework:** Next.js 15+ (App Router)
- **API:** Hono integrated into Next.js API Routes + tRPC for type-safe client-server communication.
- **Database:** PostgreSQL (Neon) & Drizzle ORM.
- **Queue/Jobs:** Custom In-Memory/DB-backed Job Scheduler (running within Next.js or via Cron Scripts).

## Features

- **Ingest-First Sync:** Fetches raw data from suppliers to DB, then processes it.
- **Product Normalization:** Intelligent parsing of product titles and attributes.
- **Pricing Rules:** Configurable pricing logic.
- **Dashboard:** Real-time monitoring of sync status and logs.

## Getting Started

### Prerequisites
- Node.js 20+ or Bun 1.x
- PostgreSQL Database

### Installation

```bash
bun install
```

### Configuration

1. Create a `.env` file in the root directory (copy from `.env.example` if available).
2. Configure your database URL and Shopify credentials.

```env
DATABASE_URL=postgresql://...
SHOPIFY_SHOP_DOMAIN=...
SHOPIFY_ACCESS_TOKEN=...
```

### Database Setup

Apply the schema to your database:
```bash
bun run db:push
```

### Running Development Server

Start the unified application:
```bash
bun run dev
```

- **Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API:** [http://localhost:3000/api](http://localhost:3000/api)

## Project Structure

```
ruzgarlastik-prd-sync/
├── apps/
│   └── web/            # Unified Next.js Application
│       ├── src/app     # App Router (Pages & API)
│       ├── src/services # Business Logic & Workers
│       └── scripts/    # Operational Scripts (Cron, Admin)
├── packages/
│   ├── api/            # Shared API definitions
│   ├── auth/           # Authentication logic
│   └── db/             # Database schema & client
└── conductor/          # Project Management & Documentation
```

## Operational Scripts

Operational scripts are located in `apps/web/scripts`. They can be run via Bun:

- **Validate & Sync:**
  ```bash
  bun run apps/web/scripts/validate-and-sync.ts
  ```
- **Check DB:**
  ```bash
  bun run apps/web/scripts/check-db.ts
  ```
- **Create Admin User:**
  ```bash
  bun run apps/web/scripts/create-admin.ts
  ```