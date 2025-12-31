# Tech Stack - Rüzgar Lastik Sync

## Core Technologies
- **Runtime:** Bun - Hızlı çalışma zamanı ve paket yöneticisi.
- **Frontend Framework:** Next.js (App Router) - Modern, SEO dostu ve performanslı React framework.
- **Backend Framework:** Hono - Hafif ve yüksek performanslı sunucu çatısı.
- **API Layer:** tRPC - Frontend ve backend arasında uçtan uca tip güvenliği.
- **Styling:** TailwindCSS & shadcn/ui - Hızlı ve tutarlı arayüz geliştirme.

## Data & Infrastructure
- **Database:** PostgreSQL (Neon) - Sunucusuz ve ölçeklenebilir ilişkisel veritabanı.
- **ORM:** Drizzle ORM - TypeScript öncelikli, hafif ve hızlı veritabanı erişim katmanı.
- **Authentication:** Better-Auth - Modern ve güvenli kimlik doğrulama çözümü.
- **Monorepo Management:** Turborepo - Optimize edilmiş monorepo yapılandırması.

## Synchronization & Workflow
- **Automation:** GitHub Actions - Cron job desteği ile periyodik senkronizasyon (her 4 saatte bir).
- **Service Pattern:** Modüler servis mimarisi ile veri normalizasyonu, fiyatlandırma ve Shopify entegrasyonu yönetimi.
- **Environment Management:** dotenv - Güvenli çevre değişkenleri yönetimi.
