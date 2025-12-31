# Tech Stack - Rüzgar Lastik Sync (Unified)

## Architecture
- **Unified Next.js:** Proje `apps/web` klasöründe birleştirilmiştir. Frontend ve API (Hono) tek bir port (3000) üzerinden çalışır.
- **API Engine:** Hono, Next.js API Routes (`/api/*`) içine entegre edilmiştir.
- **Side Project Approach:** Ana siteyi destekleyen, sadece panel odaklı hafif mikro-servis mimarisi.

## Core Technologies
- **Frontend/Backend:** Next.js 15+ (App Router)
- **API:** Hono + tRPC
- **Database:** PostgreSQL (Neon) & Drizzle ORM
- **Auth:** Better-Auth (Dahili entegre)
- **Runtime:** Bun

## Environment
- **Merkezi .env:** Root dizinindeki `.env` dosyası tek kaynaktır.
- **Sync:** Ingest-First (Önce DB'ye indir, sonra işle).