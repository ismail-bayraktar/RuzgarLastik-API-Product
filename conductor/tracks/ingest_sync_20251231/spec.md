# Track Specification: Tedarikçi Veri Havuzu ve Ayrıştırılmış Sync Hattı

## 1. Amaç
Tedarikçi API'sindeki "TooManyConnections" ve hız limitlerini aşmak amacıyla, senkronizasyon sürecini iki ana faza ayırmak: **Ingestion (Veri Alımı)** ve **Processing (İşleme)**. Bu sayede geliştirme ve operasyon süreçlerinde dış bağımlılık minimize edilecek.

## 2. Kullanıcı Hikayeleri
- **Sistem Yöneticisi olarak;** "Sync Başlat" dediğimde, sistemin önce tedarikçiden tüm veriyi hızlıca veritabanına indirmesini, ardından tüm işlemleri bu yerel veri üzerinden yapmasını istiyorum. Böylece bağlantı hatası almadan defalarca test ve işlem yapabilirim.
- **Geliştirici olarak;** Fiyatlandırma kurallarını test ederken her seferinde tedarikçi API'sini beklemek istemiyorum.

## 3. Teknik Gereksinimler

### 3.1 Veritabanı Şeması
- Mevcut şemaya tedarikçiden gelen ham JSON verisini saklayacak bir yapı entegre edilmeli veya mevcut `productMap` tablosu bu "Raw Data"yı saklayacak şekilde güncellenmeli.
- Öneri: `productMap` tablosuna `raw_data` (jsonb) kolonu eklenmesi veya geçici bir `supplier_ingest_buffer` tablosu.

### 3.2 Servis Mimarisi Güncellemesi
- **SupplierService:** Artık doğrudan işlenmiş ürün döndürmeyecek. `fetchAllAndStoreRaw()` metoduna sahip olacak.
- **SyncOrchestrator:**
  - Adım 1: `SupplierService.fetchRaw()` tetikle -> DB'ye yaz.
  - Adım 2: DB'den `readRawProducts()` ile veriyi oku.
  - Adım 3: Normalizasyon ve diğer adımları başlat.

### 3.3 Dashboard Güncellemesi
- Sync durumu artık iki aşamalı gösterilmeli:
  1. "Veri İndiriliyor..." (Tedarikçi -> DB)
  2. "İşleniyor & Gönderiliyor..." (DB -> Shopify)

## 4. Kabul Kriterleri
- [ ] Tedarikçi API'sine sadece "Ingest" aşamasında, tek bir oturumda istek atılmalı.
- [ ] Çekilen ham veriler veritabanında eksiksiz saklanmalı.
- [ ] Normalizasyon ve Fiyatlandırma testleri, internet bağlantısı kesilse bile yerel veritabanındaki verilerle çalışabilmeli.
- [ ] Dashboard üzerinde bu akış (Data Fetched -> Processing -> Completed) net bir şekilde izlenebilmeli.
