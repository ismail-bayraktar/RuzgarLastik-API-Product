# Product Guide - Rüzgar Lastik Sync

## Initial Concept
Shopify ürün API senkronizasyon sistemi. Tedarikçi verilerini normalize ederek Shopify'a aktaran, fiyatlandırma kurallarını yöneten ve tüm süreci izlenebilir kılan bir köprü uygulaması.

## Ürün Vizyonu
Rüzgar Lastik Sync, otomotiv yan sanayi (lastik, jant, akü) sektöründeki karmaşık tedarikçi verilerini, Shopify'ın modern e-ticaret altyapısına sorunsuz ve akıllı bir şekilde bağlayan merkezi bir yönetim platformudur.

## Hedef Kullanıcılar
- **Envanter Yöneticileri:** Fiyatlandırma stratejilerini belirlemek ve stok durumunu takip etmek için.
- **Dış Tedarikçiler:** Veri akışının doğruluğunu ve sürekliliğini sağlamak için.
- **Shopify Mağaza Yöneticileri:** Ürün listelemelerini ve metafield verilerini denetlemek için.

## Temel Hedefler ve Başarı Kriterleri
- **Tam Otomasyon:** Manuel müdahaleyi minimize eden, GitHub Actions destekli 4 saatlik senkronizasyon döngüleri.
- **Dinamik Fiyatlandırma:** Kategori ve marka bazlı markup kuralları ile karlılığı anlık yönetme yeteneği.
- **Merkezi İzleme:** Tüm senkronizasyon geçmişinin, başarı oranlarının ve hataların PostgreSQL tabanlı detaylı loglanması.

## MVP (Minimum Uygulanabilir Ürün) Özellikleri
- **Veri Normalizasyonu:** Tedarikçi verilerinin (lastik ölçüleri, jant özellikleri, akü kapasiteleri) otomatik ayrıştırılması ve Shopify metafield şemasına uygun hale getirilmesi.
- **Markup Motoru:** Kategori bazlı varsayılan ve marka bazlı özel fiyat artış kurallarının uygulanması.
- **Sync Raporlama:** Senkronizasyon oturumlarının başarı statüleri ve güncellenen ürün istatistiklerinin dashboard üzerinde sunulması.

## Geliştirme Prensipleri
- **Sürdürülebilirlik:** Yeni tedarikçi ve kategori eklemeyi kolaylaştıran servis odaklı mimari (Service Pattern).
- **Güvenilirlik:** Hata durumlarında sistemin devamlılığını sağlayan retry mekanizmaları ve veri bütünlüğü kontrolleri.
- **Performans:** Shopify API limitlerine uyumlu (rate limiting) ve optimize edilmiş veritabanı sorguları ile yüksek işlem hızı.
