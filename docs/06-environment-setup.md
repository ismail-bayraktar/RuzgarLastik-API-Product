# 06 - Environment Setup Guide (Hızlı Kurulum)

## 🚀 Tek Komutla Başlatma

Bu proje modern **Bun** runtime ve **Unified Monorepo** mimarisi kullanır. Başlatmak çok basittir.

### 1. Bağımlılıkları Yükle

```bash
bun install
```

### 2. Çevresel Değişkenleri Ayarla

`apps/web/.env.local` dosyasını oluşturun ve `docs/05-env-configuration.md` içindeki değerleri yapıştırın.

En azından şunlar olmalı:
*   `DATABASE_URL` (Neon'dan alın)
*   `BETTER_AUTH_SECRET` (Rastgele bir string)

### 3. Veritabanını Hazırla

Schema'yı Neon veritabanına gönderin:

```bash
bun db:push
```

*(Bu komut tabloları otomatik oluşturur)*

### 4. Uygulamayı Başlat

```bash
bun dev
```

Tarayıcıda **http://localhost:3000** adresine gidin.

---

## Admin Hesabı Oluşturma

İlk kurulumda admin hesabı yoktur. Kayıt formunu kullanarak oluşturabilirsiniz:

1. **http://localhost:3000/login** adresine gidin.
2. **Sign Up** sekmesine geçin.
3. Bilgileri girin (Email: `admin@ruzgarlastik.com`, Şifre: `GüçlüBirŞifre`).
4. Kayıt olun. Artık Dashboard'a erişebilirsiniz.

---

## İlk Sync İşlemi

Dashboard'a girdikten sonra:

1. `/dashboard/products` sayfasına gidin.
2. Ürün listesi boşsa, veritabanına veri çekmeniz gerekir.
3. Terminalden Ingest scriptini çalıştırın:
   ```bash
   bun run apps/web/scripts/ingest.ts
   ```
4. Dashboard'a dönüp sayfayı yenileyin. Ürünleri görmelisiniz (Statü: Raw).
5. Sağ üstteki **"Verileri Yeniden İşle"** butonuna basın. (Statü: Valid olacaktır).
6. Sync sayfasına gidip **"Shopify'a Gönder"** diyerek işlemi tamamlayın.