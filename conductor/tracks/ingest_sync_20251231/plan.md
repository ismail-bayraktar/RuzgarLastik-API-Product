# Track Plan: Tedarikçi Veri Havuzu ve Ayrıştırılmış Sync Hattı

## Phase 1: Veritabanı ve Ingestion Altyapısı
- [x] Task: DB Şema Güncellemesi - Raw Data Desteği de15736
  - **Açıklama:** `productMap` veya yeni bir tablo üzerinde tedarikçiden gelen ham JSON verisini saklayacak `raw_data` alanını oluştur.
  - **Teknik Detay:** Drizzle şema güncellemesi ve migrasyon oluşturulması.
  - **Test:** Migrasyonun başarıyla çalışması ve dummy veri yazılabilmesi.

- [x] Task: SupplierService Refactoring - Fetch & Store 9fd0253
  - **Açıklama:** `SupplierService` içinde `fetchFromApiAndStore()` metodunu yaz. Bu metod sadece veriyi çekip veritabanına "Raw" olarak kaydetmeli, işleme yapmamalı.
  - **Test:** Mock API veya gerçek API ile verilerin DB'ye "raw" olarak indiğinin teyidi.

## Phase 2: Ayrıştırılmış İşleme Hattı (Decoupled Pipeline)
- [x] Task: SyncOrchestrator - Akış Ayrımı c8f9714
  - **Açıklama:** Mevcut tek parça akışı ikiye böl.
    1. `ingest()`: Tedarikçiden DB'ye.
    2. `process()`: DB'den (raw_data) oku -> Normalize Et -> Fiyatla -> Shopify'a Hazırla.
  - **Test:** `process()` fonksiyonunun internet bağlantısı olmadan da çalışabildiğinin doğrulanması.

- [x] Task: Ürün Normalizasyon ve Fiyatlandırma Adaptasyonu 5fb4e1a
  - **Açıklama:** Mevcut `titleParser` ve `pricingService`'in, canlı API verisi yerine veritabanındaki `raw_data` kolonundan gelen veriyi kullanacak şekilde güncellenmesi.

## Phase 3: Dashboard ve UI Entegrasyonu
- [x] Task: Dashboard Sync Durum Göstergeleri 29d57b6
  - **Açıklama:** UI'da Sync işleminin "Veri İndiriliyor" ve "İşleniyor" aşamalarını ayrı ayrı veya birleşik bir progress bar ile göster.
  - **Test:** Sync başlatıldığında UI'ın doğru statüleri anlık yansıtması.

## Phase 4: Mimari Sadeleştirme ve Stabilizasyon
- [x] Task: Apps Birleştirme (Unified Next.js)
  - **Açıklama:** Server ve Web uygulamaları apps/web altında birleştirildi.
- [x] Task: apps/server Klasörünü Sil
  - **Açıklama:** Unified yapı doğrulandıktan sonra eski server klasörünü kaldır.
- [x] Task: Conductor - User Manual Verification 'Unified Architecture' (Protocol in workflow.md)
  - **Status:** Completed via successful production deployment and login verification.