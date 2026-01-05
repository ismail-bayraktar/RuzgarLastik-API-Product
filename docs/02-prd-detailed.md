# 02 - Detaylı PRD (Product Requirements Document)

## 📋 İçindekiler

1. [Executive Summary](#executive-summary)
2. [Functional Requirements](#functional-requirements)
3. [Data Models & Schemas](#data-models--schemas)
4. [API Contracts](#api-contracts)
5. [Admin Dashboard Features](#admin-dashboard-features)
6. [Integration Points](#integration-points)

---

## Executive Summary

### Proje Adı
**Rüzgar Lastik Sync – Better-T-Stack Edition**

### Versiyon
2.1.0 (Unified Architecture + Live Sync)

### Başlıca Özellikler

1. **Decoupled Sync Pipeline (Ayrıştırılmış Akış)**
   - **Ingest:** Veriyi çek, ham olarak kaydet (`raw_api_data`).
   - **Process:** Ham veriyi parse et, kuralları uygula, `valid` işaretle.
   - **Sync:** Sadece `valid` ve değişmiş ürünleri Shopify'a gönder.

2. **Advanced Title Parsing**
   - Regex ve mantıksal analiz (heuristic) birleşimi.
   - Lastik, Jant ve Akü için özel ayrıştırıcılar.
   - Hatalı veriyi tespit etme ve raporlama yeteneği.

3. **Admin Dashboard (Live Control)**
   - Gerçek zamanlı veri izleme.
   - Manuel müdahale (Reprocess, Sync Start).
   - Detaylı hata analizi (Product Drawer).

---

## Functional Requirements

### FR-1: Ingestion (Veri Alımı)
- **Kaynak:** Tedarikçi API veya Mock Data.
- **Hedef:** `supplierProducts` tablosu.
- **Davranış:** Veriyi olduğu gibi `raw_data` kolonuna yazar. Asla veri kaybetmez.

### FR-2: Processing (Veri İşleme)
- **Girdi:** `supplierProducts` tablosundaki `raw` statülü (veya tüm) ürünler.
- **İşlem:**
  - `TitleParserService`: Başlıktan teknik özellikleri (ebat, endeks vb.) çıkarır.
  - `PricingRulesService`: Maliyet üzerine kategori/marka marjlarını ekler.
  - `ValidationService`: Zorunlu alanları (fiyat, stok, başlık) kontrol eder.
- **Çıktı:** `validationStatus` ('valid' | 'invalid') ve `metafields` kolonu güncellenir.

### FR-3: Synchronization (Shopify Gönderim)
- **Girdi:** `valid` veya `needs_update` statüsündeki ürünler.
- **İşlem:**
  - **Kontrol:** Shopify'da ürün var mı? (SKU kontrolü).
  - **Create/Update:** Yoksa oluştur, varsa güncelle.
  - **Veri Zenginleştirme:**
    - `DescriptionGeneratorService`: Teknik özellikleri içeren HTML tablo ve özet metin oluşturur.
    - `Metafields`: Kategoriye özel alanları (`lastikGenislik`, `jantCap`) eşler ve günceller.
    - `Tags`: Hem modern (`Kategori:Lastik`) hem de eski sistem (`tip_lastik`) etiketlerini basar.
    - `Inventory`: Stok takibini (`inventoryManagement: SHOPIFY`) açar ve negatif stok koruması (`Math.max(0)`) uygular.
- **Rate Limit:** `ShopifyService` içinde cost-based throttling (Bucket algoritması).

### FR-4: Admin Dashboard
- **Ürün Listesi:** Tüm veritabanını (`supplierProducts`) gösterir.
- **Filtreleme:** `Invalid` ürünleri göstererek hatalı verileri bulmayı sağlar.
- **Detay Görünümü:** Her ürünün ham verisini, parse edilmiş halini ve Shopify durumunu gösteren yan panel (Drawer).
- **Reprocess:** "Verileri Yeniden İşle" butonu ile parser mantığı değiştikçe veriyi tazeleyebilme.

---

## Data Models & Schemas

### Supplier Products Table (`supplierProducts`)

Bu tablo projenin kalbidir. Hem ham veriyi hem işlenmiş veriyi tutar.

```typescript
export const supplierProducts = pgTable("supplier_products", {
  id: serial("id").primaryKey(),
  supplierSku: varchar("supplier_sku", { length: 255 }).notNull().unique(),
  
  // Raw Data (Dokunulmamış)
  rawApiData: json("raw_api_data"), // Tüm API yanıtı
  
  // Processed Data
  title: text("title"),
  category: varchar("category", { length: 50 }), // tire, rim, battery
  brand: varchar("brand", { length: 100 }),
  
  // Pricing & Stock
  price: integer("price"), // Cents (Kuruş)
  stock: integer("stock"),
  
  // Validation
  validationStatus: varchar("validation_status").default("raw"), // raw, valid, invalid
  validationErrors: json("validation_errors"),
  
  // Shopify Link
  shopifyProductId: varchar("shopify_product_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  
  // Parsed Metafields
  metafields: json("metafields"), // { width: 205, ratio: 55 ... }
});
```

---

## API Contracts (Updated)

### Sync Router (`trpc.sync`)

- **`preview`**: Veritabanından `valid` ürünleri çeker ve simülasyon yapar.
- **`start`**: Canlı sync işlemini başlatır.
  - `mode`: 'full' | 'incremental'
  - `dryRun`: boolean (true ise Shopify'a yazmaz)
  - `productLimit`: number (işlenecek ürün sayısı)
- **`reprocessAll`**: Tüm veritabanını baştan aşağı yeniden parse eder ve validasyon durumlarını günceller.

### Products Router (`trpc.products`)

- **`list`**: Sayfalamalı ürün listesi (arama, filtreleme destekli).
- **`syncStats`**: Dashboard widget'ları için özet istatistikler.

---

## Integration Points

### 1. Shopify Admin API
- **Kullanım:** Ürün oluşturma, güncelleme, stok yönetimi.
- **Kısıt:** Rate limit (Cost-based).

### 2. Vercel (Hosting)
- **Kullanım:** Next.js uygulamasını ve API routelarını barındırır.
- **Kısıt:** Serverless function timeout (max 10s-60s). Bu yüzden uzun işlemler (Sync) batch'ler halinde veya asenkron yapılmalıdır.

### 3. Neon DB (Database)
- **Kullanım:** Tüm verilerin kalıcı saklanması.
- **Özellik:** Serverless PostgreSQL, connection pooling.