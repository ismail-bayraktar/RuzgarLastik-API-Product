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

**Çözüm:**
`apps/web/.env.local` dosyasının varlığını ve içeriğini kontrol edin.

---

## Better Auth Hataları

### ❌ 500 Internal Server Error (Login)

**Çözüm:**

```bash
# 1. Database bağlantısını kontrol et
bun db:push

# 2. Secret'ın varlığını kontrol et
grep "BETTER_AUTH_SECRET" apps/web/.env.local
```

---

## Port ve Bağlantı Hataları

### ❌ EADDRINUSE: Port 3000

**Hata Mesajı:**
```
error: Failed to start server. Is port 3000 in use?
```

**Çözüm (Windows):**

```powershell
Stop-Process -Name "bun" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
```

---

## Vercel Build Hataları

### ❌ Build Failed: Lockfile Mismatch

**Hata Mesajı:**
```
error: lockfile had changes, but lockfile is frozen
```

**Çözüm:**
Vercel projesinde `vercel.json` kullanıyoruz ve `installCommand: "bun install"` olarak ayarlandı (frozen lockfile kapalı). Eğer hala hata alıyorsanız lokalde `bun install` çalıştırıp `bun.lockb` dosyasını commit edin.

### ❌ 404 on API Routes (Production)

**Belirtiler:**
API routeları çalışmıyor, sayfa yenileyince 404.

**Çözüm:**
Vercel projesinde "Framework Preset" olarak **Next.js** seçili olduğundan emin olun. `vercel.json` içinde `framework: "nextjs"` ayarı bu yüzden vardır.

---

## Hızlı Tanı Komutları

```powershell
# 1. Sistemi başlat
bun dev

# 2. Shopify bağlantısını test et (API route üzerinden)
# (Tarayıcıda) http://localhost:3000/api/shopify-test

# 3. .env kontrolü
Test-Path "apps/web/.env.local"
```

---

## Yardım İçin

Eğer bu rehberde çözüm bulamadıysanız:

1. `docs/` klasöründeki diğer dökümanlara bakın
2. Server loglarını detaylı inceleyin
3. GitHub Issues'a bakın
4. Stack trace'i tam olarak paylaşın

