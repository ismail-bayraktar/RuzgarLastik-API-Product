# 02 - Detaylı PRD (Product Requirements Document)

## 📋 İçindekiler

1. [Executive Summary](#executive-summary)
2. [Functional Requirements](#functional-requirements)
3. [Non-Functional Requirements](#non-functional-requirements)
4. [Data Models & Schemas](#data-models--schemas)
5. [API Contracts](#api-contracts)
6. [Admin Dashboard Features](#admin-dashboard-features)
7. [Integration Points](#integration-points)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Performance Targets](#performance-targets)
10. [Security Requirements](#security-requirements)

---

## Executive Summary

### Proje Adı
**Rüzgar Lastik Sync – Better-T-Stack Edition**

### Versiyon
2.0.0 (Yeniden Yazılım)

### Hedef Tarih
2 hafta içinde MVP

### Başlıca Özellikler

1. **Otomatik Ürün Senkronizasyonu**
   - Tedarikçi API → Normalize → Shopify
   - 4 saatte bir çalışan GitHub Actions
   - Manuel tetikleme seçeneği

2. **Fiyat Kuralları (Dynamic Pricing)**
   - Kategori bazlı markup (lastik: +%20, jant: +%18, akü: +%15)
   - Marka/Pattern/Size bazlı ek kurallar
   - Admin panelden CRUD yapılabilir

3. **Metafield Management**
   - 16+ field, 3 kategori
   - Otomatik tip coercion
   - Şema validation

4. **Admin Dashboard**
   - Better Auth ile güvenli login
   - Real-time sync tracking
   - Pricing rule CRUD
   - Settings management

5. **Monitoring & Logging**
   - PostgreSQL'de detaylı sync logs
   - Dashboard'da görüntü
   - Error reporting

---

## Functional Requirements

### FR-1: Tedarikçi API Entegrasyonu

**Amaç:** Tedarikçiden ürün verisi çekmek

**Gereksinimler:**

```
FR-1.1: Mock Supplier API
  - Input: Mock JSON dosyası
  - Output: Product Array
  - Paging: Hayır (test için basit)

FR-1.2: Real Supplier API (Future)
  - Endpoint: REST API
  - Auth: API Key
  - Paging: Offset/limit veya cursor-based
  - Rate Limit: Supplier rate limit'e saygı göstermek

FR-1.3: Error Handling
  - Network hata → Retry (exponential backoff)
  - Malformed JSON → Log & Skip
  - API unauthorized → Alert admin
```

**Örnek Mock Response:**

```json
{
  "success": true,
  "data": [
    {
      "sku": "TIRE-205-55R16-MICHELIN",
      "title": "Michelin Primacy 4 205/55R16 91V",
      "category": "tire",
      "price": 850.00,
      "cost": 650.00,
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

---

### FR-2: Ürün Parsing & Normalisasyon

**Amaç:** Ham tedarikçi datasını Shopify modeline dönüştürmek

**Gereksinimler:**

```
FR-2.1: Title Parsing (Tire)
  - Input: "Michelin Primacy 4 205/55R16 91V"
  - Output:
    - width: 205
    - ratio: 55
    - diameter: 16
    - load_index: 91
    - speed_index: "V"
  - Regex: Robust (multiple formats)

FR-2.2: Title Parsing (Rim)
  - Input: "Alminyum Jant 7Jx17 5x112 ET45"
  - Output:
    - material: "Alminyum"
    - width: 7
    - diameter: 17
    - pcd: "5x112"
    - offset: 45

FR-2.3: Title Parsing (Battery)
  - Input: "Varta Blue Dynamic 60Ah 540A"
  - Output:
    - brand: "Varta"
    - model: "Blue Dynamic"
    - capacity: 60
    - cca: 540

FR-2.4: Category Detection
  - Auto-detect: tire | rim | battery
  - Fallback: Supplier'dan `category` field'ı kullan

FR-2.5: EU Label Resolution
  - Önce supplier datasını kontrol et
  - Boş ise → Tahmin algoritması (brand/model mapping)
  - Output: fuel (A-G), wet (A-G), noise (dB)
```

**Output Model:**

```typescript
interface NormalizedProduct {
  sku: string;
  title: string;
  category: "tire" | "rim" | "battery";
  price: number;        // Supplier maliyeti
  stock: number;
  handle?: string;      // Shopify slug
  metafields: {
    [key: string]: unknown;
  };
  images?: Array<{
    src: string;
    alt: string;
  }>;
}
```

---

### FR-3: Fiyatlandırma & Marj Uygulaması

**Amaç:** Tedarikçi maliyetine göre satış fiyatını hesaplamak

**Gereksinimler:**

```
FR-3.1: Kategori Bazlı Default Markup
  - Tire: +%25 (1.25x multiplier)
  - Rim: +%20 (1.20x)
  - Battery: +%18 (1.18x)
  - Configurable via admin panel

FR-3.2: Additional Price Rules
  - Marka bazlı: "Michelin tire" → extra +%5
  - Size bazlı: "17 inch rim" → extra +%3
  - Segment bazlı: "Premium tire" → +%10
  - Multiple rules: Additive (toplanır)

FR-3.3: Price Calculation Algorithm
  basePrice = cost
  finalPrice = basePrice * categoryMarkup * (1 + sumOfRules)
  
  Örn:
  cost = 650 TL
  categoryMarkup = 1.25 (tire)
  rules = +0.05 (Michelin) + 0.02 (premium) = 0.07
  
  finalPrice = 650 * 1.25 * (1 + 0.07)
             = 650 * 1.25 * 1.07
             = 872.875 ≈ 873 TL

FR-3.4: Admin Rule Management
  - CRUD operations via dashboard
  - Real-time enable/disable
  - Test calculation (dry-run)
```

---

### FR-4: Shopify Synchronization

**Amaç:** Normalized ürünleri Shopify'a gönderip yönetmek

**Gereksinimler:**

```
FR-4.1: Product Create
  - GraphQL mutation: productCreate
  - Input: title, handle, body, vendor, ...
  - Metafields: Ayrı create işleminde

FR-4.2: Product Update
  - GraphQL mutation: productUpdate
  - Trigger: Data hash değişimi tespit edildiğinde
  - Fields: price, title, inventory, ...

FR-4.3: Metafield Management
  - Create definition (ilk sefer)
  - Set metafield values (her sync'de)
  - Type validation (eski hata: number_decimal vs integer)

FR-4.4: Inventory Update
  - inventorySetQuantities mutation
  - Location ID required (şu an: gid://shopify/Location/XXX)
  - Track: InventoryItem ID eşleştirmesi

FR-4.5: Diff Detection & Optimization
  - Hash comparison: Supplier data hash vs. database'deki hash
  - Unchanged → Skip (hız)
  - Changed → Update

FR-4.6: Rate Limit Handling
  - Cost-based throttling
  - Max: 2000 points, restore: 100 points/s
  - Batch size: 50 (estimate)
  - Exponential backoff: 1s, 2s, 4s, fail
```

---

### FR-5: Admin Dashboard

**Amaç:** Sistem yönetimi ve monitoring

**Gereksinimler:**

```
FR-5.1: Authentication
  - Better Auth
  - Email + Password (basit, admin sadece 1 user)
  - Session cookie

FR-5.2: Overview Page
  - Toplam ürün sayısı (by category)
  - Son sync session: başlangıç, bitiş, stats
  - Success rate (%)
  - Quick actions: Sync now, View logs

FR-5.3: Sync Control Page
  - Manual sync trigger
  - Options:
    - Categories: checkboxes (tire, rim, battery)
    - Limit: input field (100, 500, all)
    - Mode: incremental | full
    - Dry run: test mode (Shopify'a yazma yok)
  - Progress: real-time bar
  - Live logs: son 50 işlem

FR-5.4: Pricing Rules Page
  - Table view: all rules
  - CRUD actions: Create, Edit, Delete
  - Form fields:
    - Name (text)
    - Category (select: tire/rim/battery)
    - Match field (select: brand, size, pattern, etc.)
    - Match value (text, regex allowed)
    - Markup: percentage (%) or fixed (TL)
    - Active: toggle
  - Test calculation: "Bunu test et" button

FR-5.5: Settings Page
  - Read-only display:
    - Shopify domain, API version
    - Supplier API status
  - Configurable:
    - Batch size (input, min 10, max 200)
    - Concurrency (input, min 1, max 10)
    - Max retries (input, min 1, max 5)
  - Save changes button

FR-5.6: Logs Page
  - Detailed table: session logs
  - Filters: date range, status (success/partial/failed), category
  - Export: CSV
  - Details: click row → modal (item-level details)
```

---

## Non-Functional Requirements

### NFR-1: Performance

```
NFR-1.1: Sync Speed
  - 100 products: < 120 seconds
  - 500 products: < 600 seconds
  - Metric: products/second ≥ 0.8

NFR-1.2: API Response Time
  - Dashboard loads: < 2s
  - Price rule CRUD: < 1s
  - List logs: < 3s (pagination)

NFR-1.3: Database Queries
  - N+1 problem yok (JOIN optimize)
  - Indexes: sku, category, created_at, status
```

### NFR-2: Reliability

```
NFR-2.1: Error Recovery
  - Single product error → sistem devam (graceful)
  - Partial success log edilen (not failed)
  - Retry logic: max 3 retries

NFR-2.2: Data Integrity
  - Type validation: pre-Shopify
  - Constraint check: unique SKU
  - Rollback: if metafield fails, ürün update yapma

NFR-2.3: Uptime
  - Target: 99.5% (minimal downtime)
  - Scheduled maintenance: off-hours (gece)
```

### NFR-3: Maintainability

```
NFR-3.1: Code Structure
  - Service pattern: SupplierService, ShopifyService, etc.
  - Clear separation: sync logic ≠ HTTP routing
  - Testability: unit tests, integration tests

NFR-3.2: Documentation
  - Each service: JSDoc comments
  - Flow diagrams: Mermaid/ASCII
  - Example: per endpoint + payload

NFR-3.3: Monitoring
  - Structured logs (JSON)
  - Error tracking (stack trace)
  - Dashboard visible (sync logs table)
```

### NFR-4: Security

```
NFR-4.1: Authentication
  - Better Auth middleware
  - CSRF protection
  - Secure cookie (httpOnly, secure flag)

NFR-4.2: Authorization
  - Admin-only routes
  - API endpoints: require session or API key

NFR-4.3: Secrets Management
  - .env file (local)
  - Environment variables (production)
  - Never log sensitive data

NFR-4.4: Data Privacy
  - No PII in logs (mask email, phone)
  - Database backups: encrypted
```

---

## Data Models & Schemas

### Products Table (product_map)

```typescript
export const productMap = pgTable('product_map', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 255 }).notNull().unique(),
  category: varchar('category', { length: 50 }).notNull(),
  // tire | rim | battery
  
  shopifyId: varchar('shopify_id', { length: 255 }),
  // gid://shopify/Product/...
  
  inventoryItemId: varchar('inventory_item_id', { length: 255 }),
  // gid://shopify/InventoryItem/...
  
  dataHash: varchar('data_hash', { length: 255 }),
  // SHA256 of supplier data (for diff detection)
  
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Sync Sessions Table

```typescript
export const syncSessions = pgTable('sync_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  
  status: varchar('status', { length: 20 }).notNull(),
  // 'running' | 'success' | 'partial' | 'failed'
  
  mode: varchar('mode', { length: 50 }),
  // 'incremental' | 'full'
  
  stats: json('stats').default({}),
  // { total, created, updated, skipped, failed }
  
  errorSummary: text('error_summary'),
  // Aggregated error messages
});
```

### Sync Items Table

```typescript
export const syncItems = pgTable('sync_items', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id').references(() => syncSessions.id),
  
  sku: varchar('sku', { length: 255 }),
  action: varchar('action', { length: 50 }),
  // 'create' | 'update' | 'skip' | 'error'
  
  message: text('message'),
  details: json('details'),
  // { supplier_data, parsed_data, error_reason, etc. }
  
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Price Rules Table

```typescript
export const priceRules = pgTable('price_rules', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  
  matchField: varchar('match_field', { length: 50 }).notNull(),
  // 'brand' | 'size' | 'pattern' | 'model' | etc.
  
  matchValue: varchar('match_value', { length: 255 }).notNull(),
  // "Michelin" | "17 inch" | "premium" | etc.
  
  percentageMarkup: numeric('percentage_markup', 
    { precision: 5, scale: 2 }),
  // 0.05 = +5%, -0.10 = -10%
  
  fixedMarkup: numeric('fixed_markup', 
    { precision: 10, scale: 2 }),
  // 100.00 TL
  
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(0),
  // Higher = applied first
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Settings Table

```typescript
export const settings = pgTable('settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  // JSON stringified if complex
  
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Example keys:
// - "category_markup_tire" → "1.25"
// - "category_markup_rim" → "1.20"
// - "category_markup_battery" → "1.18"
// - "batch_size" → "50"
// - "sync_concurrency" → "5"
```

---

## API Contracts

### tRPC Procedures (Backend)

#### Sync Router

```typescript
// Input & Output types

type SyncStartInput = {
  categories: Array<"tire" | "rim" | "battery">;
  limit?: number;
  mode?: "incremental" | "full";
  dryRun?: boolean;
};

type SyncSession = {
  id: string;
  status: "running" | "success" | "partial" | "failed";
  stats: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  startedAt: Date;
  finishedAt?: Date;
};

// Procedures

router.mutation('syncStart', (input: SyncStartInput) => Promise<SyncSession>);
// Yeni sync başlat

router.query('getSyncSession', (id: string) => Promise<SyncSession>);
// Aktif sync durumunu sor

router.query('getSyncLogs', (opts: {
  sessionId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) => Promise<Array<SyncItem>>;
// Session log'larını getir
```

#### Price Rules Router

```typescript
type PriceRule = {
  id: number;
  name: string;
  category: "tire" | "rim" | "battery";
  matchField: string;
  matchValue: string;
  percentageMarkup?: number;
  fixedMarkup?: number;
  isActive: boolean;
};

type CreateRuleInput = Omit<PriceRule, "id">;

router.mutation('createRule', (input: CreateRuleInput) => Promise<PriceRule>);
router.mutation('updateRule', (input: PriceRule) => Promise<PriceRule>);
router.mutation('deleteRule', (id: number) => Promise<{ success: boolean }>;

router.query('getRules', (category?: string) => Promise<Array<PriceRule>>;

router.query('testPrice', (input: {
  cost: number;
  category: "tire" | "rim" | "battery";
  brand?: string;
  size?: string;
}) => Promise<{ originalPrice: number; finalPrice: number }>;
```

#### Settings Router

```typescript
type SettingsValue = Record<string, unknown>;

router.query('getSettings') => Promise<SettingsValue>;
// Tüm settings (admin-only)

router.mutation('updateSetting', (input: {
  key: string;
  value: unknown;
}) => Promise<SettingsValue>;
// Tek setting güncelle
```

---

## Admin Dashboard Features

### Pages Layout

```
/dashboard (Protected)
├─ /overview
│  ├─ Total products card
│  ├─ Last sync status
│  ├─ Quick sync button
│  └─ Recent logs (last 10)
├─ /sync
│  ├─ Sync options (category, limit, mode)
│  ├─ Dry run toggle
│  ├─ Start button
│  ├─ Progress bar (live)
│  └─ Live logs table
├─ /pricing-rules
│  ├─ Rules table
│  ├─ Add rule button → Modal form
│  ├─ Edit/Delete actions
│  └─ Test calculator
├─ /settings
│  ├─ System status
│  ├─ Configurable params
│  └─ Save button
└─ /logs
   ├─ Full session history
   ├─ Filters (date, status, category)
   ├─ Export CSV
   └─ Detail view (click row)
```

---

## Integration Points

### External APIs

1. **Shopify Admin API (GraphQL)**
   - Endpoint: `https://{SHOP}.myshopify.com/admin/api/2024-10/graphql.json`
   - Auth: X-Shopify-Access-Token header
   - Operations: product{Create,Update}, metafield{Set}, inventory{SetQuantities}

2. **Supplier API**
   - Endpoint: `{SUPPLIER_API_URL}` (configurable)
   - Auth: Bearer token or API key
   - Format: REST JSON
   - Paging: TBD (mock version yapılacak)

3. **Neon PostgreSQL (Cloud)**
   - Connection: Pooled connection string
   - Backup: Auto (Neon feature)

---

## Error Handling & Recovery

### Error Types & Actions

| Error | Severity | Action | Log Level |
|---|---|---|---|
| Network timeout | High | Retry (exp backoff) | ERROR |
| Invalid JSON | Medium | Skip product, log | WARN |
| Shopify API error | High | Partial success | ERROR |
| Metafield type mismatch | High | Type coercion attempt | WARN |
| Rate limit | Medium | Backoff & retry | INFO |
| Auth failed | Critical | Stop, alert | ERROR |
| Unknown error | Medium | Log stack, continue | ERROR |

### Recovery Strategy

```
sync_session → products loop
  → fetch_supplier
  → transform
  → validate
  → compare_hash
    → if_unchanged: skip
    → if_changed: shopify_update
      → if_error:
        → log_error
        → mark_failed
        → continue (graceful)
      → if_success:
        → update_hash
        → mark_updated
end_loop
  → aggregate_stats
  → log_session (success | partial | failed)
  → notify_admin (if_failed)
```

---

## Performance Targets

### Throughput

- **Small batch (10 products):** 10–15 seconds
- **Medium batch (100 products):** 100–150 seconds
- **Large batch (500 products):** 500–750 seconds
- **Target:** 3–5 products/second (network latency included)

### Database

- **Index strategy:** SKU (unique), category, created_at, session_id
- **Query time:** < 100ms (simple queries)
- **Bulk insert:** < 5s (1000 rows)

### Dashboard

- **Page load:** < 2s (Next.js App Router optimized)
- **Table pagination:** < 1s (50 rows)
- **Form submit:** < 2s (including DB write)

---

## Security Requirements

### Authentication & Authorization

- **Method:** Better Auth (session-based)
- **Users:** Single admin account (for now)
- **Protected routes:** All `/api/*`, all dashboard pages
- **Public routes:** None

### Data Protection

- **Secrets:** ENV variables (never hardcoded)
- **Logs:** Mask Shopify tokens, API keys
- **Database:** Passwords hashed (if ever user system expands)
- **HTTPS:** Required (Vercel auto)

### API Security

- **CORS:** Restrict to own domain
- **Rate limiting:** Per-IP (optional for admin use)
- **CSRF:** tRPC built-in protection
- **Input validation:** Zod schema (tRPC native)

---

## Success Criteria

✅ Sistem 2 hafta içinde MVP state'e geçer  
✅ Admin dashboard üzerinden sync tetiklenebilir  
✅ Fiyat kuralları yönetilir  
✅ Logs PostgreSQL'de tutulur ve görüntülenebilir  
✅ 100 ürün < 150s senkronize edilir  
✅ Shopify metafields doğru tip ve değerlerle set edilir  
✅ Rate limit'e takılmaz (adaptive backoff)  
✅ Hata toleranslı (1 ürün fail → sistem devam)  

---

## Notes & Open Questions

1. **Supplier API:** Gerçek API'nin format/paging yapısı?
2. **Images:** Ürün resimlerini sync etmek gerekli mi?
3. **Variants:** Multi-variant ürünler var mı (beden/renk)?
4. **Automation:** Sadece GitHub Actions mı, yoksa cron job da mı?
5. **Notifications:** Sync fail ise email/Slack bildirim göndersin mi?

> Cevaplar ile ilgili dokümantasyon güncelleme yapılacak.
