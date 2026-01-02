# 06 - Environment Setup Guide

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Neon PostgreSQL Kurulumu](#neon-postgresql-kurulumu)
3. [Shopify API Credentials](#shopify-api-credentials)
4. [Better Auth Secret Üretimi](#better-auth-secret-üretimi)
5. [Tedarikçi API Konfigürasyonu](#tedarikçi-api-konfigürasyonu)
6. [Tam .env Şablonu](#tam-env-şablonu)
7. [Doğrulama Adımları](#doğrulama-adımları)

---

## Genel Bakış

Bu proje **iki ayrı .env dosyası** gerektirir:

| Dosya | Konum | Amaç |
|-------|-------|------|
| `apps/server/.env` | Backend (Hono) | Database, Shopify, Auth, Supplier |
| `apps/web/.env` | Frontend (Next.js) | API URL'leri, Auth |

**⚠️ ÖNEMLİ:** `.env` dosyaları asla Git'e commit edilmemeli! `.gitignore`'da zaten engellenmiştir.

---

## Neon PostgreSQL Kurulumu

### Adım 1: Hesap Oluşturma

1. **https://console.neon.tech** adresine gidin
2. GitHub veya Google ile giriş yapın (ücretsiz)
3. "Create a project" butonuna tıklayın

### Adım 2: Proje Oluşturma

| Alan | Değer |
|------|-------|
| Project name | `ruzgarlastik-sync` |
| Postgres version | 16 (default) |
| Region | `eu-central-1` (Frankfurt - Türkiye'ye yakın) |

### Adım 3: Connection String Alma

1. Proje dashboard'unda **"Connection Details"** bölümüne gidin
2. **"Connection string"** seçeneğini tıklayın
3. Aşağıdaki formatta bir string kopyalayın:

```
postgresql://neondb_owner:AbCdEfGh123456@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### Adım 4: .env'e Ekleme

```bash
# apps/server/.env
DATABASE_URL=postgresql://neondb_owner:AbCdEfGh123456@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### ⚠️ Yaygın Hatalar

| Hata | Sebep | Çözüm |
|------|-------|-------|
| `NeonDbError: Unable to connect` | Yanlış/eksik DATABASE_URL | Neon console'dan tekrar kopyala |
| `ConnectionRefused` | localhost kullanılmış | Gerçek Neon URL'i kullan |
| `relation "user" does not exist` | Migration yapılmamış | `bun db:push` çalıştır |

---

## Shopify API Credentials

### Adım 1: Custom App Oluşturma

1. **Shopify Admin** → Settings → Apps and sales channels
2. **"Develop apps"** → "Create an app"
3. App adı: `Ruzgar Lastik Sync`

### Adım 2: API Scopes Tanımlama

**Configuration** → **Admin API integration** → Configure:

| Scope | Açıklama |
|-------|----------|
| `read_products` | Ürünleri okuma |
| `write_products` | Ürün oluşturma/güncelleme |
| `read_inventory` | Stok okuma |
| `write_inventory` | Stok güncelleme |
| `read_locations` | Depo bilgisi |

### Adım 3: Access Token Alma

1. **"Install app"** butonuna tıklayın
2. **Admin API access token** → "Reveal token once"
3. **Token'ı hemen kopyalayın!** (Tekrar gösterilmez)

```bash
# Format: shpat_xxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Adım 4: Location ID Bulma

**Yöntem 1: Shopify Admin**
- Settings → Locations → Depo seçin → URL'deki ID

**Yöntem 2: GraphQL**
```bash
# Backend çalışırken:
curl http://localhost:5000/api/shopify-test
```

```bash
# .env'e ekle (GID formatında):
SHOPIFY_LOCATION_ID=gid://shopify/Location/12345678901
```

### Adım 5: Shop Domain

Shopify Admin URL'inizden alın:
```
https://admin.shopify.com/store/YOUR-STORE-NAME
→ YOUR-STORE-NAME.myshopify.com
```

```bash
SHOPIFY_SHOP_DOMAIN=your-store-name.myshopify.com
```

---

## Better Auth Secret Üretimi

Better Auth, session'ları imzalamak için **en az 32 karakter** uzunluğunda güvenli bir secret gerektirir.

### Yöntem 1: Node.js ile (Önerilen)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Çıktı örneği:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Yöntem 2: OpenSSL ile

```bash
openssl rand -base64 32
```

### Yöntem 3: Bun ile

```bash
bun -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

### .env'e Ekleme

```bash
# Her iki .env dosyasında da AYNI değer olmalı!

# apps/server/.env
BETTER_AUTH_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
BETTER_AUTH_URL=http://localhost:5000

# apps/web/.env
BETTER_AUTH_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
BETTER_AUTH_URL=http://localhost:5000
```

**⚠️ ÖNEMLİ:** Frontend ve backend'de **aynı secret** kullanılmalı!

---

## Tedarikçi API Konfigürasyonu

### Mock Mode (Development)

Gerçek tedarikçi API'si olmadan geliştirme yapmak için:

```bash
USE_MOCK_SUPPLIER=true
```

### Real API Mode (Production)

```bash
USE_MOCK_SUPPLIER=false
SUPPLIER_API_LASTIK=https://api.tedarikci.com/lastik
SUPPLIER_API_JANT=https://api.tedarikci.com/jant
SUPPLIER_API_AKU=https://api.tedarikci.com/aku
SUPPLIER_API_TIMEOUT=30000
```

---

## Tam .env Şablonu

### apps/server/.env

```bash
# ============================================
# DATABASE (Neon PostgreSQL)
# ============================================
# Nereden alınır: https://console.neon.tech → Project → Connection Details
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# ============================================
# BETTER AUTH
# ============================================
# Secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_SECRET=your-generated-secret-min-32-chars-here
BETTER_AUTH_URL=http://localhost:5000

# ============================================
# CORS
# ============================================
CORS_ORIGIN=http://localhost:3000

# ============================================
# SHOPIFY
# ============================================
# Nereden alınır: Shopify Admin → Settings → Apps → Develop apps → Your App
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-10
# Nereden alınır: Settings → Locations → URL'deki ID veya /api/shopify-test
SHOPIFY_LOCATION_ID=gid://shopify/Location/123456789

# ============================================
# SUPPLIER API
# ============================================
USE_MOCK_SUPPLIER=true
# Gerçek API kullanılacaksa:
# SUPPLIER_API_LASTIK=https://...
# SUPPLIER_API_JANT=https://...
# SUPPLIER_API_AKU=https://...
SUPPLIER_API_TIMEOUT=30000

# ============================================
# SERVER
# ============================================
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug
```

### apps/web/.env

```bash
# ============================================
# NEXT.JS PUBLIC VARIABLES
# ============================================
NEXT_PUBLIC_SERVER_URL=http://localhost:5000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# BETTER AUTH (Backend ile aynı olmalı!)
# ============================================
BETTER_AUTH_SECRET=your-generated-secret-min-32-chars-here
BETTER_AUTH_URL=http://localhost:5000
```

---

## Doğrulama Adımları

### 1. Database Bağlantısı

```bash
# packages/db dizininde:
cd packages/db
bun run test-connection.ts
```

Veya:
```bash
bun db:push
# Başarılı çıktı: "Changes applied"
```

### 2. Shopify Bağlantısı

Backend çalışırken:
```bash
curl http://localhost:5000/api/shopify-test
```

**Başarılı çıktı:**
```json
{
  "success": true,
  "shop": {
    "name": "Your Store Name",
    "email": "admin@yourstore.com"
  }
}
```

### 3. Auth Test

```bash
# Backend çalışırken login dene:
curl -X POST http://localhost:5000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","name":"Test"}'
```

### 4. Tam Sistem Testi

```bash
# Tüm sistemi başlat:
bun dev

# Tarayıcıda:
# http://localhost:3000/login
# admin@ruzgarlastik.com / RuzgarLastik2024!
```

---

## Checklist

Projeyi başlatmadan önce kontrol edin:

- [ ] Neon database oluşturuldu
- [ ] DATABASE_URL doğru formatta (postgresql://...neon.tech/...)
- [ ] BETTER_AUTH_SECRET üretildi (min 32 karakter)
- [ ] BETTER_AUTH_SECRET her iki .env'de aynı
- [ ] Shopify app oluşturuldu ve scopes tanımlandı
- [ ] SHOPIFY_ACCESS_TOKEN alındı
- [ ] SHOPIFY_LOCATION_ID belirlendi
- [ ] `bun db:push` çalıştırıldı (migration)
- [ ] `bun dev` ile sistem başlatıldı
- [ ] Login test edildi

---

## Sonraki Adımlar

1. `.env` dosyalarını oluşturun
2. `bun install` ile bağımlılıkları kurun
3. `bun db:push` ile database'i hazırlayın
4. `bun dev` ile sistemi başlatın
5. http://localhost:3000/login adresinden giriş yapın

