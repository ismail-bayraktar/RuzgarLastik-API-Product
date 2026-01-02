# Specification: Systematic Pipeline Rebuild (Backend 2.0)

## Overview
Bu track, projenin temel veri akışını (Ingest -> Process -> Sync) en baştan, sistemli ve modüler bir şekilde yeniden inşa etmeyi hedefler. Amaç; veri kaybını önlemek, API limitlerini yönetmek ve her adımın veritabanı üzerinden izlenebildiği ("Ingest-First") sağlam bir altyapı kurmaktır.

## Functional Requirements

### 1. Ingestion (Veri Toplama)
- **Tedarikçi -> DB (Ham Veri):** API'den gelen veriler, hiçbir işlem görmeden `supplier_products` tablosundaki `raw_api_data` sütununa kaydedilir.
- **Minimal Kontrol:** Sadece SKU varlığı kontrol edilir.
- **Retry & Backoff:** 429 (Rate Limit) hatalarında üstel bekleme (exponential backoff) uygulanır.
- **Değişim Takibi:** Mevcut bir ürün gelirse, fiyat/stok kontrol edilir; değişim varsa `raw` statüsüne geri çekilir ve tarihçe tablosuna kaydedilir.

### 2. Processing (Veri İşleme & Validasyon)
- **Bağımsız Çalışabilme:** İşleme scripti manuel tetiklenebilir (`bun run process.ts`).
- **Otomatik Tetikleme:** Ingest işlemi bittiğinde otomatik başlar.
- **Mantık Taşıma:** Mevcut Title Parser (Ebat ayrıştırma) ve Pricing Rules (Marj hesaplama) bu scriptlere entegre edilir.
- **Statü Yönetimi:** Ürünler `raw` -> `valid` / `invalid` -> `ready_to_sync` aşamalarından geçer. Hatalar veritabanına açıkça yazılır.

### 3. Synchronization (Shopify Güncelleme)
- **Delta Sync:** Sadece lokal veride (DB) fiyat veya stok Shopify'daki son senkronize edilen değerden farklıysa güncelleme yapılır.
- **Soft Delete:** Tedarikçiden silinen ürünlerin Shopify'daki stoğu 0 yapılır.
- **Görsel Koruması:** Mevcut ürünlerde görseller tekrar yüklenmez, sadece yeni ürünlerde yüklenir.
- **Dry Run:** Gerçek işlem yapmadan rapor üreten test modu.

## Acceptance Criteria
1. `validate-and-sync.ts` scripti terminalden hatasız çalışmalı.
2. Veritabanındaki `raw_api_data` her zaman güncel tedarikçi yanıtını içermeli.
3. Shopify'a sadece "ready_to_sync" statüsündeki ürünler gitmeli.
4. Hatalı ürünler (eksik ebat, 0 fiyat vb.) Dashboard'da hata mesajıyla listelenmeli.
