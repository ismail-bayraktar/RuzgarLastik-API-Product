# 07 - Troubleshooting Guide

## 📋 İçindekiler

1. [Database Hataları](#database-hataları)
2. [Better Auth Hataları](#better-auth-hataları)
3. [Shopify API Hataları](#shopify-api-hataları)
4. [Port ve Bağlantı Hataları](#port-ve-bağlantı-hataları)
5. [Build ve TypeScript Hataları](#build-ve-typescript-hataları)
6. [Yaşanan Sorunlar ve Çözümleri](#yaşanan-sorunlar-ve-çözümleri)

---

## Database Hataları

### ❌ NeonDbError: Unable to connect

**Hata Mesajı:**
```
NeonDbError: Error connecting to database: Unable to connect. Is the computer able to access the url?
path: "https://localhost/sql"
code: "ConnectionRefused"
```

**Sebep:** 
`.env` dosyasında `DATABASE_URL` yanlış konfigüre edilmiş. Yerel PostgreSQL adresi kullanılmış ama proje Neon Serverless adapter kullanıyor.

**Çözüm:**

1. https://console.neon.tech adresinden gerçek connection string alın
2. `.env` dosyasını düzeltin:

```bash
# YANLIŞ:
DATABASE_URL=postgresql://user:password@localhost:5432/ruzgarlastik

# DOĞRU:
DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

---

### ❌ relation "user" does not exist

**Hata Mesajı:**
```
error: relation "user" does not exist
```

**Sebep:** 
Database tabloları oluşturulmamış (migration yapılmamış).

**Çözüm:**

```bash
# Schema'yı database'e push et:
bun db:push
```

---

### ❌ relation "fetch_jobs" does not exist

**Hata Mesajı:**
```
Failed query: select ... from "fetch_jobs"
```

**Sebep:** 
Yeni eklenen `supplier.ts` schema'sındaki tablolar database'e push edilmemiş.

**Çözüm:**

```bash
bun db:push
```

---

### ❌ .env Dosyası Kaybolmuş/Değişmiş

**Belirtiler:**
- Login 500 hatası veriyor
- Database bağlantı hatası
- Daha önce çalışan sistem çalışmıyor

**Olası Sebepler:**
1. AI Agent (Claude/Cursor) `.env` dosyasını yeniden oluşturmuş
2. Yanlışlıkla üzerine yazılmış
3. Template dosyası kopyalanmış

**Kontrol:**
```powershell
# .env dosyalarının son değişiklik tarihini kontrol et:
Get-ChildItem -Recurse -Filter "*.env*" -File | Select-Object FullName, LastWriteTime
```

**Çözüm:**
1. Neon console'dan DATABASE_URL'i tekrar alın
2. Better Auth secret'ı yeniden üretin
3. `.env` dosyalarını `docs/06-environment-setup.md` şablonuna göre yeniden oluşturun

---

## Better Auth Hataları

### ❌ 500 Internal Server Error (Login)

**Hata Mesajı:**
```
POST /api/auth/sign-in/email 500 15ms
```

**Olası Sebepler:**

1. **Database bağlantı hatası** - En yaygın sebep
2. **BETTER_AUTH_SECRET eksik**
3. **Tablo yok** - Migration yapılmamış

**Tanı:**
```bash
# Server error log'larını kontrol et:
Get-Content "apps/server/server-error.log" -Tail 50
```

**Çözüm:**

```bash
# 1. Database bağlantısını kontrol et
bun db:push

# 2. Secret'ın varlığını kontrol et
grep "BETTER_AUTH_SECRET" apps/server/.env

# 3. Secret üret (yoksa)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### ❌ CSRF Token Mismatch

**Sebep:**
Frontend ve backend'de farklı `BETTER_AUTH_SECRET` kullanılıyor.

**Çözüm:**
Her iki `.env` dosyasında da **aynı** secret olmalı:

```bash
# apps/server/.env
BETTER_AUTH_SECRET=ayni-secret-degeri

# apps/web/.env  
BETTER_AUTH_SECRET=ayni-secret-degeri
```

---

### ❌ Cookie Not Set

**Sebep:**
Development'ta HTTPS gerektiren cookie ayarları.

**Çözüm:**
`packages/auth/src/index.ts` dosyasında doğru ayarlar:

```typescript
advanced: {
  defaultCookieAttributes: {
    sameSite: isDev ? "lax" : "none",
    secure: !isDev,  // Development'ta false olmalı
    httpOnly: true,
  },
},
```

---

## Shopify API Hataları

### ❌ Missing SHOPIFY_ACCESS_TOKEN

**Hata Mesajı:**
```json
{
  "success": false,
  "error": "Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ACCESS_TOKEN"
}
```

**Çözüm:**
`.env` dosyasına Shopify credentials ekleyin. Detaylar: `docs/06-environment-setup.md`

---

### ❌ Location ID Not Found

**Hata Mesajı:**
```
Inventory update failed: Location not found
```

**Çözüm:**

1. Shopify Admin → Settings → Locations
2. Depo seçin → URL'deki ID'yi alın
3. GID formatında ekleyin:

```bash
SHOPIFY_LOCATION_ID=gid://shopify/Location/123456789
```

---

### ❌ Rate Limit (429 Too Many Requests)

**Hata Mesajı:**
```
Throttled: Rate limit exceeded
```

**Çözüm:**

1. Batch size'ı düşürün:
```bash
SYNC_BATCH_SIZE=25  # 50'den 25'e
```

2. Concurrency'yi düşürün:
```bash
SYNC_CONCURRENCY=3  # 5'ten 3'e
```

---

## Port ve Bağlantı Hataları

### ❌ EADDRINUSE: Port Already in Use

**Hata Mesajı:**
```
error: Failed to start server. Is port 5000 in use?
code: "EADDRINUSE"
```

**Çözüm (Windows):**

```powershell
# 1. Port'u kullanan process'i bul
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess

# 2. Process'i durdur
Stop-Process -Id <PROCESS_ID> -Force

# Veya tüm bun process'lerini durdur:
Stop-Process -Name "bun" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
```

**Çözüm (macOS/Linux):**

```bash
# Port'u kullanan process'i bul ve durdur
lsof -ti:5000 | xargs kill -9
```

---

### ❌ CORS Error

**Hata Mesajı (Browser Console):**
```
Access to fetch at 'http://localhost:5000' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Çözüm:**
`.env` dosyasında CORS_ORIGIN doğru ayarlanmalı:

```bash
# apps/server/.env
CORS_ORIGIN=http://localhost:3000
```

---

## Build ve TypeScript Hataları

### ❌ Cannot find module

**Çözüm:**

```bash
# Bağımlılıkları yeniden kur
bun install

# Cache temizle
rm -rf node_modules/.cache
```

---

### ❌ Type errors in packages

**Çözüm:**

```bash
# Tüm paketlerde type check
bun run check-types
```

---

## Yaşanan Sorunlar ve Çözümleri

### 📅 24.12.2025 - Database Bağlantı Hatası

**Problem:**
Login yaparken 500 hatası. Server loglarında:
```
NeonDbError: Error connecting to database
path: "https://localhost/sql"
code: "ConnectionRefused"
```

**Root Cause:**
`.env` dosyasındaki `DATABASE_URL` yanlışlıkla yerel PostgreSQL adresine değiştirilmiş:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ruzgarlastik
```

Proje Neon Serverless adapter kullanıyor, bu yüzden gerçek Neon URL'i gerekli.

**Çözüm:**
1. https://console.neon.tech adresinden connection string alındı
2. `.env` dosyası düzeltildi:
```
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```
3. `bun db:push` ile tablolar oluşturuldu
4. Sistem yeniden başlatıldı

**Önlem:**
- `.env` dosyalarını düzenli olarak yedekleyin
- Önemli credential'ları güvenli bir yerde saklayın (1Password, Bitwarden vb.)
- AI agent'ların `.env` dosyalarını değiştirmesine dikkat edin

---

## Hızlı Tanı Komutları

```powershell
# 1. Sunucu durumunu kontrol et
curl http://localhost:5000/

# 2. Shopify bağlantısını test et
curl http://localhost:5000/api/shopify-test

# 3. Server loglarını gör
Get-Content "apps/server/server.log" -Tail 20
Get-Content "apps/server/server-error.log" -Tail 20

# 4. Port kullanımını kontrol et
Get-NetTCPConnection -LocalPort 5000,3000 -ErrorAction SilentlyContinue

# 5. Bun process'lerini gör
Get-Process -Name "bun" -ErrorAction SilentlyContinue

# 6. .env dosyalarının varlığını kontrol et
Test-Path "apps/server/.env"
Test-Path "apps/web/.env"
```

---

## Yardım İçin

Eğer bu rehberde çözüm bulamadıysanız:

1. `docs/` klasöründeki diğer dökümanlara bakın
2. Server loglarını detaylı inceleyin
3. GitHub Issues'a bakın
4. Stack trace'i tam olarak paylaşın

