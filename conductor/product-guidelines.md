# Product Guidelines - Rüzgar Lastik Sync

## İletişim Dili ve Tonu
- **Kullanıcı Dostu ve Çözüm Odaklı:** Sistem mesajları, teknik terimlerden ziyade sürecin durumunu ve çözüm yollarını net bir şekilde ifade etmelidir.
  - *Kötü:* "Error 500: Sync Failed"
  - *İyi:* "Senkronizasyon Başarısız: Tedarikçi sunucusuna erişilemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin."
- **Şeffaf Bilgilendirme:** Kullanıcı her adımda sistemin ne yaptığını (Sync Başladı, Veriler İşleniyor, Tamamlandı) anlamalıdır.

## Görsel Tasarım ve UX Prensipleri
- **Veri Odaklı Modern Arayüz:** Yoğun veri setleri (ürün listeleri, loglar) kompakt ve düzenli tablolarla sunulmalı, ancak modern ve ferah bir tasarım dili (bol boşluk, net tipografi) korunmalıdır.
- **Yönlendirici Yardımcılar (Tooltips):** Arayüz, sistemi ilk kez kullanan birinin bile süreçleri (Test → Sync Başlat → İzle) kolayca takip edebileceği şekilde, butonlar ve veri alanları üzerinde açıklayıcı ipuçları (tooltips) içermelidir.
- **Net Durum Göstergeleri:** Başarı (Yeşil), Uyarı (Sarı) ve Hata (Kırmızı) durumları renklerle ve ikonlarla anında ayırt edilebilir olmalıdır.

## İşlevsel Kılavuzlar
- **Zaman Hassasiyeti:** Tüm tarih ve saat göstergeleri, yerel saat dilimine (Türkiye Saati - TRT) tam uyumlu ve doğru olmalıdır. "Son Güncelleme: 14:30" gibi net zaman damgaları kritik öneme sahiptir.
- **Otomasyon ve İzlenebilirlik:**
  - **Kur ve Unut:** Sistem, bir kez yapılandırıldıktan sonra arka planda otonom çalışacak şekilde tasarlanmalıdır.
  - **Değişiklik Odaklılık:** Sadece fiyat veya stok değişikliği olan ürünlerin güncellenmesi ve bu değişikliklerin net bir şekilde raporlanması esastır.
  - **Kolay Takip:** Kullanıcı panele girdiğinde en son senkronizasyonun ne zaman yapıldığını ve sonucunu tek bakışta görebilmelidir.
