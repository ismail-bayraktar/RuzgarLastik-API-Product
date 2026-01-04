# Claude Context Guide - Rüzgar Lastik Sync (Better-T-Stack Edition)

## 📋 İçindekiler

1. [Proje Özeti](#proje-özeti)
2. [Eski Projeden Öğrendiklerimiz](#eski-projeden-öğrendiklerimiz)
3. [Yeni Stack Mimarisi](#yeni-stack-mimarisi)
4. [Eski Dökümantasyondan Çıkarılan Karakteristikler](#eski-dökümantasyondan-çıkarılan-karakteristikler)
5. [Kritik Bilgiler & Uyarılar](#kritik-bilgiler--uyarılar)
6. [Başlama Checklist](#başlama-checklist)

---

## Proje Özeti

**Rüzgar Lastik Sync**, türkiye'deki bir lastik/jant/akü e-ticareti işletmesinin **Shopify mağazası** ile **tedarikçi sistemleri** arasında otomatik bir senkronizasyon köprüsü kuran yazılımdır.

### Problem Alanı

- **Tedarikçi tarafında:** Binlerce lastik, jant, akü ürünü; fiyatlar, stok seviyeleri sık sık değişiyor.
- **Shopify tarafında:** Her ürünü manuel olarak eklemek imkansız; otomatik senkronizasyon yapılması gerekli.
- **Özel Zorluk:** 
  - Lastik/jant ürünleri çok teknik veriye sahip (genişlik, oran, jant çapı, PCD, hız indeksi vb.)
  - EU etiketleme düzenlemeleri (yakıt verimlilik, ıslak aderans, dış gürültü)
  - Fiyat stratejisi kategori bazlı değişiyor (lastik/jant/akü farklı marjlar)

### Çözüm Sunulan Şey

Bu proje, tüm bu süreci **tam otomasyonla**, **hata toleransı** ve **geri dönüşüm kontrol** mekanizmaları ile yönetir.

---

## Eski Projeden Öğrendiklerimiz

Eski proje (Node.js + Next.js API Routes sürümü) gerçekten **çalışıyordu**, ancak:

- 📌 Mimari olarak dağınıktı (frontend ve backend iç içe)
- 📌 Hono kadar lightweight değildi → server maliyeti yüksek
- 📌 Test edilmesi zor → integration test eksikti
- 📌 Metafield type uyumsuzlukları hata üretiyordu
- 📌 Rate limit handling manuel ve kütüphanelere bağımlıydı

### Eski Projenin Başarılı Yönleri

✅ **Metafield mapping** çok iyi tasarlanmıştı (19 alan, 3 kategori)  
✅ **Title parsing** yakın tarihli; "205/55R16 91V" → genişlik/oran/çap otomatik  
✅ **EU etiket tahmin sistemi** vardı (title/brand/model kombinasyonundan)  
✅ **GitHub Actions** ile otomasyon kullanıyordu (4 saatte bir sync)  
✅ **Rate limiting** Shopify limitlerini referans alıyordu  

### Eski Sistemde Yaşanan Sorunlar

❌ Metafield type hataları → `Type 'number_decimal' must be consistent with...`  
❌ SKU field hataları → GraphQL mutation'ında field yok  
❌ Location ID boş kaldığında stok güncellemesi başarısız  
❌ Fiyat kuralları hardcoded → Her değişiklik için kod güncelleme  
❌ Admin paneli basit → Sadece log okuyabiliyordu, ayar yönetimi yoktu  

---

## Yeni Stack Mimarisi

### Teknik Altyapı

```
┌─────────────────────────────────────────────────────┐
│  Better-T-Stack (Unified Monorepo)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📱 Unified App (Next.js)                          │
│  ├─ apps/web/                                      │
│  │  ├─ Frontend (React/Tailwind/Shadcn)           │
│  │  ├─ Backend (Next.js API Routes + Hono adapter)│
│  │  │  ├─ /api/trpc/* (tRPC Endpoints)            │
│  │  │  ├─ /api/auth/* (Better Auth)               │
│  │  │  └─ Services (Sync, Shopify, Supplier)      │
│  │  └─ Scripts (Ingest, Process, Sync CLI tools)  │
│  │                                                 │
│  🗄️  Shared Packages                                │
│  ├─ packages/db/                                   │
│  │  ├─ Drizzle schema                             │
│  │  ├─ Database migrations                        │
│  │  └─ Seed scripts                               │
│  ├─ packages/api/                                 │
│  │  └─ tRPC router definitions (merged into web)  │
│  └─ packages/config/                              │
│     └─ Ortak type definitions                     │
│                                                     │
│  📊 Database (Neon PostgreSQL - Cloud)            │
│  └─ Tables: product_map, sync_logs, settings...   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Runtime & Package Manager

- **Bun**: Node.js'den 4x hızlı (native bundler + transpiler)
- **Turborepo**: Monorepo task orchestration
- **Hono**: Next.js API Routes içinde adaptör ile çalışan lightweight framework
- **Vercel**: Production deployment platformu

---

## Eski Dökümantasyondan Çıkarılan Karakteristikler

### 1. Metafield Şeması (19 Alan, 3 Kategori)

Eski sistemde başarılı olan, **yeni sistemde korunması gereken** şeması:

#### Lastik (Tire) – 7 Alan

| Metafield Key | Type | Örnek Değer | Açıklama |
|---|---|---|---|
| `lastikGenislik` | number_integer | 205 | Lastik genişliği (mm) |
| `lastikOran` | number_integer | 55 | Boy/En oranı (%) |
| `jantCap` | number_decimal | 16.0 | Jant çapı (inch) |
| `mevsimTip` | single_line_text | "yaz" | yaz/kış/dort_mevsim |
| `hizIndeksi` | single_line_text | "V" | H/V/W/Y/Z |
| `yukIndeksi` | number_integer | 91 | Yük taşıma indeksi |
| `euYakit` | single_line_text | "B" | EU: A–G (A=best) |
| `euIslakZemin` | single_line_text | "B" | EU: A–G |
| `euGurultu` | number_integer | 71 | EU: dB değeri |

#### Jant (Rim) – 4 Alan

| Metafield Key | Type | Örnek Değer | Açıklama |
|---|---|---|---|
| `jantGenislik` | number_decimal | 7.5 | Genişlik (inch / J değeri) |
| `jantPCD` | single_line_text | "5x112" | Bolt pattern |
| `jantOffset` | number_integer | 45 | ET / Offset (mm) |
| `jantCap` | number_decimal | 17.0 | Çap (inch) |

#### Akü (Battery) – 2 Alan

| Metafield Key | Type | Örnek Değer | Açıklama |
|---|---|---|---|
| `akuKapasite` | number_integer | 60 | Ah (Amper-saat) |
| `akuCCA` | number_integer | 540 | Cold Cranking Amps |

#### Araç Uyumluluk (Optional) – 3 Alan

| Metafield Key | Type | Örnek Değer | Açıklama |
|---|---|---|---|
| `aracMarka` | single_line_text | "BMW" | Otomobil markası |
| `aracModel` | single_line_text | "3 Series" | Model adı |
| `aracYil` | number_integer | 2021 | Model yılı |

**Toplam: 16 alan** (eski dokümanda 19 sayılmış, muhtemelen 3 boş alan var)

---

### 2. Title Parsing Örneği (Eski Sistemin Başarısı)

Eski sistem şu gibi başlıklardan otomatik parse ediyordu:

#### Örnek 1: Lastik

```
Input Title: "Michelin Primacy 4 205/55R16 91V"

Çıktı:
{
  brand: "Michelin",
  model: "Primacy 4",
  width: 205,
  ratio: 55,
  rimDiameter: 16,
  loadIndex: 91,
  speedIndex: "V"
}
```

#### Örnek 2: Jant

```
Input Title: "Alminyum Jant 7Jx17 5x112 ET45"

Çıktı:
{
  material: "Alminyum",
  width: 7,
  diameter: 17,
  pcd: "5x112",
  offset: 45
}
```

#### Örnek 3: Akü

```
Input Title: "Varta Blue Dynamic 60Ah 540A 12V"

Çıktı:
{
  brand: "Varta",
  model: "Blue Dynamic",
  capacity: 60,
  cca: 540,
  voltage: 12
}
```

**Önemli:** Title parsing regex'ler **oldukça hassas**. Yeni sistemde bu parserleri **modüler service'ler** olarak yazmalı ve **kapsamlı unit test** eklemeliyiz.

---

### 3. EU Etiket Tahmin Sistemi

Eski sistem, tedarikçi API'den EU verisi **gelmediğinde**, marka/model/segment bilgisine göre **tahmin** yapıyordu:

```typescript
// Örnek tahmin algoritması (eski sistemden çıkarılan logic)

if (brand === "Michelin" && segment === "premium") {
  euFuel = "A";
  euWet = "A";
  euNoise = 70;
} else if (brand === "Lassa" && segment === "economy") {
  euFuel = "D";
  euWet = "C";
  euNoise = 73;
}
// ... vs.
```

Bu, **veri tabanı + machine learning olmadan** manuel bir mapping yapısıydı. Yeni sistemde:

- **Önce** tedarikçi verisi kontrol edilecek
- **Sonra** boş kalan alanlar için **fallback mapping** yapılacak
- **Düzenli olarak** update edilecek (semestral vs.)

---

### 4. Eski .env Yapısı (Korunacak Değerler)

Eski proyektte kullanılan env variables (Better-T'nin ortamında nasıl tutulacak, aşağıda açıklanacak):

```bash
# Shopify
SHOPIFY_SHOP_DOMAIN=tgsqxx-gb.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-10
SHOPIFY_LOCATION_ID=gid://shopify/Location/12345678

# Tedarikçi API
USE_MOCK_SUPPLIER=true|false
SUPPLIER_API_URL=https://api.supplier.com/v1
SUPPLIER_API_KEY=supplier_key_here

# Sync Konfigürasyonu
SYNC_MODE=incremental|full
BATCH_SIZE=50
SYNC_CONCURRENCY=5
MAX_RETRIES=3

# Kategoriler & Filtreler
SYNC_CATEGORIES=tire,rim,battery
SYNC_MIN_STOCK=0
SYNC_ONLY_IN_STOCK=false

# Sync Rules (Hangi veriler sync edilecek)
SYNC_CREATE_NEW=true
SYNC_UPDATE_EXISTING=true
SYNC_UPDATE_PRICES=true
SYNC_UPDATE_INVENTORY=true
SYNC_UPDATE_METAFIELDS=true

# Monitoring
LOG_LEVEL=info|debug
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Database
DATABASE_URL=postgresql://user:password@host/dbname

# Better Auth
BETTER_AUTH_SECRET=generated_secret_key
```

**Yeni sistemde:** Bunlar `apps/server/.env` ve `apps/web/.env` olarak bölünecek. Buna sonraki dokümanda detay açıklama ekleyeceğiz.

---

### 5. Eski Rate Limiting Mantığı

Shopify GraphQL API'nin cost sistemi:

- **Max:** 2000 cost point
- **Restore rate:** 100 points/s
- **Single create/update:** ~10-20 points
- **Metafield ekleme:** Extra +5-10 points

**Eski sistem:**
- Batch size 50, concurrency 5 → 300-500 ürün/dakika kabaca
- Exponential backoff: retry 1'de 1s bekleme, retry 2'de 2s, retry 3'de 4s

**Yeni sistem:**
- Hono middleware'de `RateLimiter` class
- Estimated cost hesaplanarak gerçek backoff yapılacak
- Detaylar: `docs/flows/shopify-sync-flow.md`

---

## Kritik Bilgiler & Uyarılar

### 🚨 Metafield Type Compatibility (Eski Hata)

**Eski projede yaşanan hata:**

```
Type 'number_decimal' must be consistent with the definition's type: 'number_integer'
```

**Neden:** Metafield definition Shopify tarafında `number_integer` oluşturulmuş, fakat API'den `number_decimal` (3.14 gibi) gönderilmişti.

**Yeni sistemde önlem:**

1. Drizzle schema'da metafield definitions **kesin tip** belirtilecek
2. Backend service'inde **type coercion** yapılacak (örn. 3.14 → 3)
3. Shopify'a gitmeden önce **validation** geçirilecek

---

### 🚨 Location ID Eksikliği (Eski Sorun)

**Eski projede:** Location ID boş kaldığında, stok güncellemeleri hata veriyor (başarısız)

**Yeni sistemde:**

```typescript
// apps/server/services/shopifyService.ts

const locationId = await getLocationId(); // Startup'ta çekip cache'le

if (!locationId) {
  throw new Error(
    "Location ID not configured. " +
    "Set SHOPIFY_LOCATION_ID in .env or fetch from Shopify Admin API"
  );
}
```

---

### 🚨 Title Parsing Regex'leri Hassas

Farklı ürün tiplerine göre farklı formatlar:

- Lastik: `205/55R16 91V` vs `205/55/16 91V` vs `2055516` (farklı separator)
- Jant: `7Jx17` vs `7J x 17` vs `7" x 17"`
- Akü: `60Ah 540A` vs `60AH/540A`

**Çözüm:** Her kategori için ayrı parser, kapsamlı test coverage.

---

## Başlama Checklist

### ✅ Tamamlanan Özellikler

#### 1. Ön Kurulum
- [x] Bun runtime kurulu
- [x] Better-T-Stack kurulumu yapıldı
- [x] Turborepo monorepo yapısı
- [x] Neon PostgreSQL entegrasyonu
- [x] `.env` şablonları hazır

#### 2. Drizzle & Database
- [x] Schema dosyaları (`packages/db/src/schema/`)
  - [x] `product.ts` - productMap, syncSessions, syncItems
  - [x] `pricing.ts` - pricingRules
  - [x] `settings.ts` - settings
  - [x] `cache.ts` - productsCache, cacheMetadata
  - [x] `supplier.ts` - supplierProducts, fetchJobs, history
  - [x] `auth.ts` - Better Auth tabloları
- [x] Migration dosyaları oluşturuldu
- [x] `bun db:push` ile Neon'a apply

#### 3. Unified Backend Logic (apps/web/src/services)
- [x] `syncOrchestrator.ts` - Ana sync koordinasyonu
- [x] `shopifyService.ts` - GraphQL client, rate limiting
- [x] `supplierService.ts` - Tedarikçi API
- [x] `supplierProductService.ts` - Kalıcı ürün deposu
- [x] `titleParserService.ts` - Ürün title parsing
- [x] `pricingRulesService.ts` - Fiyat hesaplama
- [x] `metafieldUtils.ts` - Metafield type coercion
- [x] `rateLimiter.ts` - Shopify rate limiting
- [x] `retryUtils.ts` - Exponential backoff
- [x] `cacheService.ts` - Ürün cache
- [x] `validationService.ts` - Ürün validasyonu
- [x] `fetchJobService.ts` - Fetch job yönetimi
- [x] `jobSchedulerService.ts` - Otomatik retry

#### 4. Frontend & UI (apps/web) - 8 Sayfa
- [x] `/dashboard` - Overview
- [x] `/dashboard/sync` - Sync pipeline UI
- [x] `/dashboard/pricing-rules` - Fiyat kuralları CRUD
- [x] `/dashboard/products` - Ürün listesi
- [x] `/dashboard/supplier` - Tedarikçi ürünleri
- [x] `/dashboard/settings` - Ayarlar
- [x] `/dashboard/logs` - Sync logları
- [x] `/dashboard/api-test` - API test arayüzü

#### 5. API Routes (tRPC)
- [x] `sync.ts` - Sync işlemleri
- [x] `products.ts` - Ürün sorguları
- [x] `priceRules.ts` - Fiyat kuralları
- [x] `settings.ts` - Ayarlar
- [x] `supplierProducts.ts` - Tedarikçi ürünleri

#### 6. Dokümantasyon - 7 Dosya
- [x] `01-claude-context.md` - Proje özeti
- [x] `02-prd-detailed.md` - Detaylı PRD
- [x] `03-metafields-reference.md` - Metafield şemaları
- [x] `04-flows-architecture.md` - Data flow diyagramları
- [x] `05-env-configuration.md` - Environment değişkenleri
- [x] `06-environment-setup.md` - Kurulum rehberi (YENİ)
- [x] `07-troubleshooting.md` - Hata çözümleri (YENİ)

### 📋 Devam Eden / Planlanan
- [ ] Unit testler (title parser vb.)
- [ ] Integration testler (Shopify mock)
- [x] GitHub Actions CI/CD (sync-cron.yml)
- [x] Production deployment (Vercel)

---

## Hızlı Başlangıç

```bash
# 1. Bağımlılıkları kur
bun install

# 2. .env dosyalarını oluştur
# Detaylar: docs/06-environment-setup.md

# 3. Database'i hazırla
bun db:push

# 4. Sistemi başlat (Unified)
bun dev

# 5. Tarayıcıda aç
# http://localhost:3000/login
# admin@ruzgarlastik.com / RuzgarLastik2024!
```

## Önemli Dökümantasyon

| Dosya | Ne Zaman Oku |
|-------|--------------|
| `06-environment-setup.md` | **İlk kurulumda - .env oluşturmak için** |
| `07-troubleshooting.md` | **Hata aldığında** |
| `02-prd-detailed.md` | Proje gereksinimlerini anlamak için |
| `03-metafields-reference.md` | Metafield çalışırken |
| `04-flows-architecture.md` | Sync akışını anlamak için |
