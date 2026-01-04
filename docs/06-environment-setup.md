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

Bu proje Unified Monorepo yapısındadır. Tüm konfigürasyon **apps/web/.env.local** dosyasında toplanır.

| Dosya | Konum | Amaç |
|-------|-------|------|
| `.env.local` | `apps/web/.env.local` | Local development secret'ları |

**⚠️ ÖNEMLİ:** `.env.local` dosyaları asla Git'e commit edilmemeli!

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
# apps/web/.env.local
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

**Yöntem 2: API**
Sync uygulaması çalışırken:
```bash
# İleride eklenecek bir endpoint ile sorgulanabilir
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

### Yöntem 1: Node.js ile (Önerilen)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### .env'e Ekleme

```bash
# apps/web/.env.local
BETTER_AUTH_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
BETTER_AUTH_URL=http://localhost:3000
```

---

## Tam .env Şablonu

### apps/web/.env.local

```bash
# ============================================
# DATABASE (Neon PostgreSQL)
# ============================================
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# ============================================
# BETTER AUTH
# ============================================
BETTER_AUTH_SECRET=your-generated-secret-min-32-chars-here
BETTER_AUTH_URL=http://localhost:3000

# ============================================
# SHOPIFY
# ============================================
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_LOCATION_ID=gid://shopify/Location/123456789

# ============================================
# SUPPLIER API
# ============================================
USE_MOCK_SUPPLIER=true
SUPPLIER_API_TIMEOUT=30000

# ============================================
# NEXT.JS PUBLIC
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

---

## Doğrulama Adımları

### 1. Database Bağlantısı

```bash
bun db:push
# Başarılı çıktı: "Changes applied" veya "No changes"
```

### 2. Tam Sistem Testi

```bash
# Tüm sistemi başlat:
bun dev

# Tarayıcıda:
# http://localhost:3000/login
# admin@ruzgarlastik.com / RuzgarLastik2024!
```

---

## Checklist

- [ ] `apps/web/.env.local` oluşturuldu
- [ ] DATABASE_URL eklendi
- [ ] BETTER_AUTH_SECRET eklendi
- [ ] SHOPIFY credentials eklendi
- [ ] `bun db:push` çalıştırıldı
- [ ] `bun dev` ile sistem başlatıldı


