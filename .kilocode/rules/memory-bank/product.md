# EventFlow PRO - Ürün Tanımı

## Neden Var?

EventFlow PRO, etkinlik organizasyonunda yaşanan operasyonel verimliliği problemlerini çözmek için geliştirilmiştir. Geleneksel etkinlik yönetiminde şu temel sorunlar bulunmaktadır:

1. **Manuel ve Dağınıklık Süreçler:** Etkinlik planlaması, masa düzeni ve personel ataması gibi süreçler manuel olarak gerçekleştirilmekte. Bu süreçler zaman alıcıyor, hata yapma riski yüksek ve operasyonel verimliliği düşüyor.

2. **Müşteri İzleme Zayıflığı:** Müşterilerin etkinlik geçmişlerini, tercihlerini ve rezervasyon geçmişini tek bir yerden takip etmek mümkün değil. CRM entegrasyonu eksik veya yetersiz.

3. **Personel-Masa Atama Verimliliği:** Büyük etkinliklerde personelin hangi masaya atanacağını manuel olarak belirlemek zor ve zaman alıcı. Bu, personel verimliliğini azaltıyor ve operasyonel hatalara yol açıyor.

4. **Check-in Süreci Yavaş:** QR kod ile check-in yapmak mümkün olsa da, süreç manuel olarak yönetiliyor ve yavaş çalışıyor. Bu, etkinlik başlangıcında kuyruk oluşturuyor.

5. **Gerçek Zamanlı Güncellemeler:** Etkinlik sırasında gerçek zamanlı güncellemeler (masa doluluğu, rezervasyon durumu değişikliği) mevcut değil. Bu, operatörler güncel durumdan habersiz kalıyor.

## Çözüm Yolları

EventFlow PRO bu sorunları çözmek için şu özellikleri sunar:

- **Otomatik Atama:** Personel-masa atama için algoritmalar (balanced, zone, random) kullanarak operasyonel verimliliğini optimize eder
- **Görsel Mekan Düzeni:** Canvas tabanlı görsel mekan düzeni ile masaları görsel olarak düzenleyebilir, sürükleme ve yeniden düzenleme imkanı sağlar
- **QR Kod Sistemi:** Her rezervasyon için benzersiz QR kod oluşturur, hızlı ve güvenli check-in sağlar
- **Gerçek Zamanlı Güncellemeler:** WebSocket ile gerçek zamanlı güncellemeler sunar
- **CRM Entegrasyonu:** Müşteri bilgileri, rezervasyon geçmişi ve notları tek bir yerde tutulur
- **Mobil Uygulama:** QR kod ile mobil check-in desteği

## Nasıl Çalışır?

### Kullanıcı Yolculuğu

1. **Etkinlik Planlama (Leader):**
   - Etkinlik oluşturur (tarih, konum, kapasite)
   - Mekan şablonu seçer veya yeni mekan düzeni oluşturur
   - Personel ekibini oluşturur veya personel atar
   - Otomatik personel-masa atama yapar
   - Davetiyeler oluşturur ve dağıtırır

2. **Rezervasyon Yönetimi (Leader):**
   - Mekan düzeninde masa seçer
   - Müşteri seçer veya yeni müşteri kaydı oluşturur
   - Rezervasyon oluşturur (masa, kişi sayısı, özel istekler)
   - QR kod oluşturur
   - Rezervasyon durumunu günceller

3. **Personel ve Ekip Yönetimi (Leader):**
   - Personel listesini görüntüler
   - Ekipler oluşturur
   - Ekip üyelerini yönetir
   - Personel-masa atamaları görüntüler
   - Otomatik atama algoritmaları çalıştırır

4. **Check-in (Check-in Operatörü):**
   - QR kod tarayıcı ile rezervasyon doğrular
   - Masa bazlı check-in yapar
   - Müşteri doğrulama
   - Gerçek zamanlı güncellemeleri görür

### Teknik Akış

1. **Etkinlik Oluşturma:**
   - Backend: Event entity oluşturma
   - Frontend: Etkinlik formu ile veri girişi
   - Database: Event tablosuna kayıt
   - Validation: Tarih, kapasite, konum validasyonu

2. **Mekan Yönetimi:**
   - Backend: Venue entity oluşturma
   - Frontend: Canvas tabanlı görsel düzeni
   - Database: Venue tablosuna kayıt
   - JSON serialization: Mekan düzeni JSON olarak saklanır

3. **Rezervasyon Sistemi:**
   - Backend: Reservation entity oluşturma
   - Frontend: Masa seçimi ve rezervasyon formu
   - Database: Reservation tablosuna kayıt
   - QR Code: qrcode kütüphanesi ile QR kod oluşturma

4. **Personel Yönetimi:**
   - Backend: Staff entity oluşturma
   - Frontend: Personel listesi ve ekip yönetimi
   - Database: Staff tablosuna kayıt
   - Atama: Staff-Table ilişki tablosu

5. **Check-in Sistemi:**
   - Backend: QR hash ile rezervasyon doğrulama
   - Frontend: html5-qrcode ile QR kod okuma
   - WebSocket: Gerçek zamanlı güncellemeler

## Kullanıcı Deneyimi Hedefleri

### Leader (Etkinlik Yöneticisi)
- **Hızlı Planlama:** Etkinlik planlama süreci 5 dakikadan tamamlanmalı
- **Görsel Düzenleme:** Mekan düzeni sürükleme ve yeniden düzenleme kolay olmalı
- **Personel Atama:** Otomatik atama algoritmaları ile personel-masa atamaları optimize edilmeli
- **Raporlama:** Etkinlik istatistikleri ve personel verimliliği anlık görüntülenebilmeli

### Check-in Operatörü
- **Hızlı Check-in:** QR kod ile check-in işlemi 3 saniyeden tamamlanmalı
- **Doğrulama:** Müşteri bilgileri ve rezervasyon detayları doğru görüntülenmeli
- **Gerçek Zamanlı Güncellemeler:** Tüm operatörler aynı anda güncellemeleri görmeli

### Müşteriler
- **Kolay Arayüzü:** Rezervasyon geçmişi ve tercihleri kolayca görüntülenebilmeli
- **CRM Entegrasyonu:** Müşteri bilgileri, rezervasyon geçmişi ve notlar tek bir yerde tutulmalı
- **Mobil Erişimi:** QR kod ile mobil check-in yapabilmeli

## Önemi

EventFlow PRO, etkinlik organizasyonu için modern, ölçeklenebilir ve kullanıcı dostu bir çözüm sunar. Sistem, manuel süreçleri otomatikleştirerek operasyonel verimliliğini artırır, hata riskini azaltır ve kullanıcı deneyimini iyileştirir.
