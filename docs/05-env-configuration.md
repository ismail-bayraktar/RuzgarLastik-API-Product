# 05 - Environment Variables & Configuration Guide

## 📋 İçindekiler

1. [Environment Dosya Yapısı](#environment-dosya-yapısı)
2. [Tek Dosya: .env.local](#tek-dosya-envlocal)
3. [Vercel Deployment Ayarları](#vercel-deployment-ayarları)

---

## Environment Dosya Yapısı

Projemiz **Unified Monorepo** yapısında olduğu için tek bir konfigürasyon noktası vardır.

```
ruzgar-lastik-sync/
├─ apps/
│  └─ web/
│     ├─ .env.local        # ← TÜM GİZLİ ANAHTARLAR BURADA (Git'e atılmaz)
│     └─ .env.example      # ← Şablon (Git'e atılır)
```

**Not:** Backend (`apps/server`) artık `apps/web` içinde birleştiği için ayrı bir `.env` dosyasına ihtiyacı yoktur.

---

## Tek Dosya: .env.local

Aşağıdaki içeriği `apps/web/.env.local` dosyasına kopyalayıp doldurun.

```bash
# ============================================
# DATABASE (Neon PostgreSQL)
# ============================================
# Neon Console -> Connection Details -> Connection String
DATABASE_URL=postgresql://neondb_owner:xxxxx@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

# ============================================
# BETTER AUTH (Kimlik Doğrulama)
# ============================================
# Secret Üretme: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_SECRET=buraya-uzun-ve-karmasik-bir-secret-yaz
BETTER_AUTH_URL=http://localhost:3000

# ============================================
# SHOPIFY (Mağaza Bağlantısı)
# ============================================
SHOPIFY_SHOP_DOMAIN=magaza-adi.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-10
SHOPIFY_LOCATION_ID=gid://shopify/Location/123456789

# ============================================
# SUPPLIER (Tedarikçi API)
# ============================================
USE_MOCK_SUPPLIER=true
SUPPLIER_API_URL=https://api.tedarikci.com/v1
SUPPLIER_API_KEY=api-key
SUPPLIER_API_TIMEOUT=30000

# ============================================
# APP (Genel Ayarlar)
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production'da Vercel URL'i (örn: https://ruzgarlastik-sync.vercel.app)

LOG_LEVEL=info
```

---

## Vercel Deployment Ayarları

Projeyi Vercel'e deploy ederken bu değişkenleri **Environment Variables** bölümüne eklemelisiniz.

1. **Database:** `DATABASE_URL` (Neon Production URL)
2. **Auth:** `BETTER_AUTH_SECRET` (Production için yeni bir secret üretin)
3. **Auth URL:** `BETTER_AUTH_URL` (Production domaininiz, örn: `https://ruzgarlastik-sync.vercel.app`)
4. **Shopify:** `SHOPIFY_` ile başlayan tüm değişkenler.

**Önemli:** `NEXT_PUBLIC_SERVER_URL` gibi değişkenlere artık ihtiyaç yoktur, Next.js API Routes aynı domain üzerinde çalışır.