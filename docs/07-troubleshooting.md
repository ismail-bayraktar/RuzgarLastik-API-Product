# 07 - Troubleshooting Guide

## 📋 Sık Karşılaşılan Sorunlar

1. [Vercel Build Hataları](#vercel-build-hataları)
2. [Parsing Sorunları (Invalid Ürünler)](#parsing-sorunları)
3. [Database Bağlantı Sorunları](#database-bağlantı-sorunları)
4. [Sync Hataları](#sync-hataları)

---

## Vercel Build Hataları

### ❌ Error: `lockfile had changes, but lockfile is frozen`

**Sebep:** `bun.lockb` dosyası ile `package.json` uyumsuz.
**Çözüm:**
1. Lokalde `bun install` çalıştırın.
2. `bun.lockb` dosyasını commitleyip pushlayın.
3. Vercel ayarlarında "Install Command" olarak `bun install` (frozen lockfile olmadan) kullanın.

### ❌ Type Errors (TS2339, TS2304...)

**Sebep:** TypeScript tip tanımları eksik veya uyumsuz.
**Çözüm:**
Acil durumlarda `apps/web/next.config.ts` dosyasına şu ayarı ekleyebilirsiniz (ama önerilmez, asıl çözüm tipleri düzeltmektir):

```typescript
typescript: {
  ignoreBuildErrors: true,
},
eslint: {
  ignoreDuringBuilds: true,
}
```

---

## Parsing Sorunları

### ❌ Ürün "Invalid" Olarak Görünüyor

**Sebep:** `TitleParserService` ürün başlığından gerekli özellikleri (örneğin Lastik için Ebat) çıkaramadı.

**Debugging Adımları:**
1. Dashboard'da **"Hatalı (Invalid)"** filtresini seçin.
2. Hatalı ürüne tıklayıp **Drawer**'ı açın.
3. **Parsing** sekmesine bakın. Hangi alanın eksik olduğu (kırmızı çarpı ile) gösterilir.
   *   Örn: `Width: ❌ (Genişlik bulunamadı)`
4. Bu başlığı not alıp `TitleParserService.ts` içindeki regex/mantığı güncelleyin.
5. Dashboard'dan **"Verileri Yeniden İşle"** butonuna basarak tekrar test edin.

---

## Database Bağlantı Sorunları

### ❌ NeonDbError: ConnectionRefused

**Sebep:** `.env` dosyasında `localhost` kullanılmış olabilir.
**Çözüm:** Neon, cloud-native bir veritabanıdır. Her zaman `postgres://...neon.tech/...` formatındaki URL'i kullanmalısınız.

### ❌ Relation "xyz" does not exist

**Sebep:** Migration yapılmamış.
**Çözüm:** `bun db:push` komutunu çalıştırın.

---

## Sync Hataları

### ❌ Shopify API: Rate Limit Exceeded

**Sebep:** Çok fazla ürün çok hızlı gönderiliyor.
**Çözüm:**
1. `apps/web/.env.local` içinde `SYNC_BATCH_SIZE` değerini düşürün (örn: 25).
2. `SYNC_CONCURRENCY` değerini düşürün (örn: 3).
3. Backend otomatik olarak `Retry-After` header'ına uyup bekleyecektir (kodlandı).

### ❌ Metafield Type Mismatch

**Sebep:** Shopify'daki tanım `integer` ama biz `string` veya `float` gönderiyoruz.
**Çözüm:** `sync.ts` router'ı içinde `coerceMetafieldValue` mantığı vardır. Veri tabanındaki değerin doğru tipe dönüştürüldüğünden emin olun.