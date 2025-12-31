# Plan: Systematic Pipeline Rebuild

## Phase 1: Database & Script Foundation
- [x] Task: Clean Slate - Reset Data 4a558a5
    - **Açıklama:** Veritabanındaki `supplier_products` verilerini temizle. Schema'yı koru, veriyi sıfırla.
- [x] Task: Implement Ingest Script (`scripts/ingest.ts`) 90f037f
    - **Açıklama:** `SupplierService`'i sadece veri çekip `raw_api_data`'ya yazacak şekilde güncelle/kullan.
    - **Detay:** Retry (3x) ve Rate Limit (2s delay) mantığı burada kesinlikle olmalı.
    - **Test:** Scripti çalıştırıp veritabanına ham JSON'ların indiğini doğrula.

## Phase 2: Logic Decoupling (Process Script)
- [ ] Task: Port Logic to Process Script (`scripts/process.ts`)
    - **Açıklama:** Mevcut `TitleParserService` ve `PricingRulesService` mantığını kullanarak veriyi işleyen bağımsız bir script yaz.
    - **Akış:**
        1. DB'den `validationStatus = 'raw'` olanları çek.
        2. Parse et (Ebatları ayır).
        3. Fiyat kurallarını uygula.
        4. Validasyon (Zorunlu alan kontrolü).
        5. Başarılıysa `validationStatus = 'valid'`, başarısızsa `invalid` + hata mesajı yaz.
    - **Test:** `bun run scripts/process.ts` ile ham verilerin işlenip sütunlara ayrıştığını doğrula.

## Phase 3: Smart Synchronization (Sync Script)
- [ ] Task: Implement Sync Script (`scripts/sync.ts`)
    - **Açıklama:** Sadece `valid` veya `needs_update` olanları Shopify'a gönder.
    - **Detay:**
        - Delta Check: `currentPrice != lastSyncedPrice` ise gönder.
        - Dry Run parametresi ekle.
    - **Test:** Dry Run modunda çalıştırıp doğru ürünleri seçtiğini doğrula.

## Phase 4: Automation & UI Hook
- [ ] Task: Unified Pipeline Script (`scripts/pipeline.ts`)
    - **Açıklama:** `Ingest -> Process -> Sync` adımlarını sırayla çalıştıran ana script.
- [ ] Task: Conductor - User Manual Verification 'Systematic Pipeline Rebuild' (Protocol in workflow.md)
