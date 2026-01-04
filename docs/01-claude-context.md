# Claude Context Guide - Rüzgar Lastik Sync (Better-T-Stack Edition)

## 📋 İçindekiler

1. [Proje Özeti](#proje-özeti)
2. [Eski Projeden Öğrendiklerimiz](#eski-projeden-öğrendiklerimiz)
3. [Yeni Stack Mimarisi (Unified)](#yeni-stack-mimarisi-unified)
4. [Kritik Bilgiler & Uyarılar](#kritik-bilgiler--uyarılar)
5. [Başlama Checklist](#başlama-checklist)

---

## Proje Özeti

**Rüzgar Lastik Sync**, Türkiye'deki bir lastik/jant/akü e-ticareti işletmesinin **Shopify mağazası** ile **tedarikçi sistemleri** arasında otomatik bir senkronizasyon köprüsü kuran yazılımdır.

### Problem Alanı

- **Tedarikçi tarafında:** Binlerce lastik, jant, akü ürünü; fiyatlar, stok seviyeleri sık sık değişiyor.
- **Shopify tarafında:** Her ürünü manuel olarak eklemek imkansız; otomatik senkronizasyon yapılması gerekli.
- **Özel Zorluk:** 
  - Lastik/jant ürünleri çok teknik veriye sahip (genişlik, oran, jant çapı, PCD, hız indeksi vb.)
  - EU etiketleme düzenlemeleri (yakıt verimlilik, ıslak aderans, dış gürültü)
  - Fiyat stratejisi kategori bazlı değişiyor (lastik/jant/akü farklı marjlar)

### Çözüm Sunulan Şey

Bu proje, tüm bu süreci **tam otomasyonla**, **hata toleransı** ve **geri dönüşüm kontrol** mekanizmaları ile yönetir. Veriler önce veritabanına indirilir (Ingest), sonra işlenir (Process) ve en son Shopify'a gönderilir (Sync).

---

## Eski Projeden Öğrendiklerimiz

Eski proje (Node.js + Next.js API Routes sürümü) gerçekten **çalışıyordu**, ancak:

- 📌 Mimari olarak dağınıktı (frontend ve backend iç içe)
- 📌 Hono kadar lightweight değildi → server maliyeti yüksek
- 📌 Test edilmesi zor → integration test eksikti
- 📌 Metafield type uyumsuzlukları hata üretiyordu
- 📌 Rate limit handling manuel ve kütüphanelere bağımlıydı

---

## Yeni Stack Mimarisi (Unified)

### Teknik Altyapı

```
┌─────────────────────────────────────────────────────┐
│  Better-T-Stack (Unified Monorepo)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📱 Unified App (Next.js - apps/web)               │
│  │                                                 │
│  ├─ Frontend (React/Tailwind/Shadcn)              │
│  │  └─ Dashboard UI (/dashboard/*)                │
│  │                                                 │
│  ├─ Backend Logic (API Routes + tRPC)             │
│  │  ├─ /api/trpc/* (Router'lar: sync, product...) │
│  │  ├─ /api/auth/* (Better Auth)                  │
│  │  └─ Services (Business Logic)                  │
│  │     ├─ TitleParserService (Advanced Regex)     │
│  │     ├─ ShopifyService (GraphQL Client)         │
│  │     └─ PricingRulesService (Dynamic Pricing)   │
│  │                                                 │
│  └─ Scripts (CLI Tools)                           │
│     ├─ ingest.ts (Fetch Raw Data)                 │
│     ├─ process.ts (Normalize & Validate)          │
│     └─ sync.ts (Push to Shopify)                  │
│                                                     │
│  🗄️  Shared Packages                                │
│  ├─ packages/db/ (Drizzle ORM Schema)             │
│  ├─ packages/api/ (tRPC Definitions)              │
│  └─ packages/config/ (Shared Types)               │
│                                                     │
│  📊 Infrastructure                                  │
│  ├─ Database: Neon PostgreSQL (Serverless)        │
│  └─ Hosting: Vercel (Next.js Serverless Functions)│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Runtime & Package Manager

- **Bun**: Node.js'den 4x hızlı (native bundler + transpiler)
- **Turborepo**: Monorepo task orchestration
- **Hono**: Next.js API Routes içinde adaptör ile çalışan lightweight framework
- **Vercel**: Production deployment platformu

---

## Kritik Bilgiler & Uyarılar

### 🚨 Metafield Type Compatibility

**Eski projede yaşanan hata:** `Type 'number_decimal' must be consistent with the definition's type: 'number_integer'`

**Çözüm:** `metafieldUtils.ts` servisi, Shopify'a göndermeden önce tüm değerleri şemaya göre zorlar (coerce).

### 🚨 Title Parsing Hassasiyeti

Farklı ürün tiplerine göre farklı formatlar:
- Lastik: `205/55R16`, `205 55 16`, `2055516`
- Jant: `7Jx17`, `17x7`, `5x112`, `ET45`
- Akü: `60Ah`, `540A`, `12V`

**Çözüm:** `TitleParserService.ts` içinde gelişmiş "Attribute Hunting" ve "Constraint-Based Parsing" mantığı kullanılıyor. Tek bir regex yerine, metin içindeki tüm sayıları analiz edip en mantıklı kombinasyonu bulur.

---

## Başlama Checklist

### ✅ Tamamlanan Özellikler

#### 1. Altyapı & Kurulum
- [x] Unified Monorepo (Next.js + tRPC)
- [x] Neon PostgreSQL entegrasyonu
- [x] Vercel Production Deployment
- [x] Better Auth (Login/Session)

#### 2. Backend Logic (Servisler)
- [x] `ingest.ts`: Tedarikçiden ham veriyi çekip DB'ye yazar.
- [x] `process.ts`: Ham veriyi parse eder, fiyatlandırır ve `valid/invalid` olarak işaretler.
- [x] `TitleParserService`: Gelişmiş regex ve mantık ile ürün özelliklerini ayıklar.
- [x] `PricingRulesService`: Kategori ve marka bazlı dinamik fiyatlandırma.
- [x] `ShopifyService`: Rate-limited GraphQL client.

#### 3. Frontend (Dashboard)
- [x] **Sync Panel:** Canlı sync başlatma, mod seçimi (Incremental/Full), Dry Run.
- [x] **Product List:** Tüm DB ürünlerini listeleme, filtreleme (Valid/Invalid).
- [x] **Product Drawer:** Ürün detaylarını, ham veriyi ve parsing sonucunu inceleme.
- [x] **Pricing Rules:** Kural ekleme, düzenleme ve silme.
- [x] **Reprocess:** Tek tıkla tüm veritabanını yeniden parse etme özelliği.

### 📋 Devam Eden / Planlanan
- [ ] Görsel (Image) senkronizasyonu (Şu an placeholder)
- [ ] Stok takibi için webhook entegrasyonu
- [ ] Gelişmiş raporlama (Grafikler)

---

## Hızlı Başlangıç

```bash
# 1. Bağımlılıkları kur
bun install

# 2. .env.local dosyasını oluştur (docs/06-environment-setup.md'ye bak)

# 3. Database'i hazırla
bun db:push

# 4. Sistemi başlat
bun dev

# 5. Tarayıcıda aç
# http://localhost:3000/login
# admin@ruzgarlastik.com / RuzgarLastik2024!
```