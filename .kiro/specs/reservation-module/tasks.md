# Implementation Plan - Reservation Module

- [x] 1. Backend Rezervasyon Servisi Geliştirmeleri

  - [x] 1.1 Kapasite validasyonu ekle

    - ReservationsService.create ve update metodlarına masa kapasitesi kontrolü ekle
    - Table entity'den kapasite bilgisi al ve guestCount ile karşılaştır
    - CapacityExceededException fırlat
    - _Requirements: 1.2, 2.1_

  - [ ]\* 1.2 Property test: Guest count validation
    - **Property 1: Guest count validation against table capacity**
    - **Validates: Requirements 1.2, 2.1**
  - [x] 1.3 Masa müsaitlik kontrolü ekle

    - isTableAvailable metodu implement et
    - create metodunda çift rezervasyon kontrolü yap
    - TableNotAvailableException fırlat
    - _Requirements: 1.3, 2.2_

  - [ ]\* 1.4 Property test: Table availability enforcement

    - **Property 2: Table availability enforcement**

    - **Validates: Requirements 1.3, 2.2**

  - [x] 1.5 İptal işleminde masa serbest bırakma

    - cancel metodunda status güncelle
    - Masa müsaitlik durumunu güncelle
    - _Requirements: 2.3_

  - [ ]\* 1.6 Property test: Cancellation frees table
    - **Property 5: Cancellation frees table**
    - **Validates: Requirements 2.3**

- [x] 2. QR Engine Geliştirmeleri

  - [x] 2.1 QR hash benzersizlik garantisi

    - generateHash metodunu güçlendir
    - Collision kontrolü ekle
    - _Requirements: 1.4_

  - [ ]\* 2.2 Property test: QR code uniqueness
    - **Property 3: QR code uniqueness**
    - **Validates: Requirements 1.4**
  - [x] 2.3 QR kod içerik yapısı

    - QR data içeriğine eventId, tableId, qrCodeHash ekle
    - Şifreleme/encoding uygula
    - _Requirements: 3.2_

  - [ ]\* 2.4 Property test: QR code content completeness
    - **Property 8: QR code content completeness**
    - **Validates: Requirements 3.2**
  - [x] 2.5 QR üretim tutarlılığı (idempotence)

    - Aynı rezervasyon için aynı QR döndür
    - Cache mekanizması ekle
    - _Requirements: 3.4_

  - [ ]\* 2.6 Property test: QR code generation consistency
    - **Property 7: QR code generation consistency (Idempotence)**
    - **Validates: Requirements 3.4**
  - [x] 2.7 Güncelleme sonrası QR korunması

    - update metodunda qrCodeHash değişmemeli
    - _Requirements: 2.4_

  - [ ]\* 2.8 Property test: QR code preservation on update
    - **Property 6: QR code preservation on update**
    - **Validates: Requirements 2.4**

-

- [x] 3. Checkpoint - Tüm testlerin geçtiğinden emin ol

  - Ensure all tests pass, ask the user if questions arise.

-

- [x] 4. Check-in Modülü Geliştirmeleri

  - [x] 4.1 QR ile rezervasyon bulma

    - findByQRCode metodunu güçlendir
    - Relations (customer, event) yükle
    - _Requirements: 4.1_

  - [ ]\* 4.2 Property test: Valid QR lookup returns reservation
    - **Property 9: Valid QR lookup returns reservation**
    - **Validates: Requirements 4.1**
  - [x] 4.3 Check-in status ve time güncellemesi

    - checkIn metodunda status=CHECKED_IN yap
    - checkInTime'ı şimdiki zamana set et
    - _Requirements: 4.2_

  - [ ]\* 4.4 Property test: Check-in updates status and time
    - **Property 10: Check-in updates status and time**
    - **Validates: Requirements 4.2**
  - [x] 4.5 Geçersiz check-in reddi

    - CHECKED_IN ve CANCELLED durumları için hata fırlat
    - InvalidCheckInException kullan
    - _Requirements: 4.3, 4.4_

  - [ ]\* 4.6 Property test: Invalid check-in rejection
    - **Property 11: Invalid check-in rejection**
    - **Validates: Requirements 4.3, 4.4**

- [x] 5. CRM Entegrasyonu

  - [x] 5.1 Müşteri ilişkilendirme

    - create metodunda customer relation kur
    - Customer entity'yi yükle
    - _Requirements: 1.5_

  - [ ]\* 5.2 Property test: Customer association correctness
    - **Property 4: Customer association correctness**
    - **Validates: Requirements 1.5**
  - [x] 5.3 Müşteri geçmişi getirme

    - getCustomerHistory metodu ekle
    - VIP score ve event geçmişi döndür
    - _Requirements: 6.1_

  - [ ]\* 5.4 Property test: Customer history retrieval
    - **Property 14: Customer history retrieval**
    - **Validates: Requirements 6.1**
  - [x] 5.5 Blacklist uyarı sistemi

    - isBlacklisted kontrolü ekle
    - Warning flag döndür
    - _Requirements: 6.2_

  - [ ]\* 5.6 Property test: Blacklist warning
    - **Property 15: Blacklist warning**
    - **Validates: Requirements 6.2**

-

- [x] 6. Checkpoint - Tüm testlerin geçtiğinden emin ol

  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Arama ve Filtreleme

  - [x] 7.1 Arama fonksiyonu implement et

    - İsim ve telefon ile partial match arama
    - Case-insensitive arama
    - _Requirements: 7.1, 7.2_

  - [ ]\* 7.2 Property test: Search returns matching results
    - **Property 16: Search returns matching results**
    - **Validates: Requirements 7.1, 7.2**
  - [x] 7.3 Filtreleme fonksiyonu implement et

    - Status ve event bazlı filtreleme
    - Birden fazla filtre kombinasyonu
    - _Requirements: 7.3, 7.4_

  - [ ]\* 7.4 Property test: Filter returns correct subset
    - **Property 17: Filter returns correct subset**
    - **Validates: Requirements 7.3, 7.4**

-

- [x] 8. Dashboard ve İstatistikler

  - [x] 8.1 Event istatistikleri hesaplama

    - getEventStats metodu implement et
    - totalExpected, checkedIn, remaining, cancelled, noShow hesapla
    - _Requirements: 5.1_

  - [ ]\* 8.2 Property test: Dashboard statistics calculation
    - **Property 12: Dashboard statistics calculation**
    - **Validates: Requirements 5.1**
  - [x] 8.3 Socket.io real-time güncellemeler

    - Check-in event'lerini broadcast et
    - Stats güncellemelerini push et
    - _Requirements: 5.2_

-

- [x] 9. Offline Support

  - [x] 9.1 Offline queue mekanizması

    - IndexedDB ile offline storage
    - Queue yönetimi implement et
    - _Requirements: 5.4_

  - [x] 9.2 Sync mekanizması

    - Online olunca queue'yu işle
    - Conflict resolution
    - _Requirements: 5.4_

  - [ ]\* 9.3 Property test: Offline queue persistence
    - **Property 13: Offline queue persistence**
    - **Validates: Requirements 5.4**

- [x] 10. Frontend Rezervasyon Sayfası

  - [x] 10.1 API entegrasyonu

    - Mock data yerine gerçek API çağrıları
    - TanStack Query ile data fetching
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.2 Rezervasyon oluşturma formu

    - Masa seçimi, müşteri seçimi, kişi sayısı
    - Validasyon mesajları
    - _Requirements: 1.1, 1.2_

  - [x] 10.3 QR kod gösterimi

    - Modal ile QR kod display
    - İndirme ve paylaşma seçenekleri
    - _Requirements: 3.1, 3.3_

- [x] 11. Frontend Check-in Sayfası

  - [x] 11.1 API entegrasyonu

    - Mock fonksiyonları gerçek API ile değiştir
    - Error handling ekle
    - _Requirements: 4.1, 4.2_

  - [x] 11.2 QR kod okuyucu entegrasyonu

    - html5-qrcode veya react-qr-reader kullan
    - Kamera izni yönetimi
    - _Requirements: 4.1_

  - [x] 11.3 Offline mode desteği

    - Service worker ile offline detection
    - Queue UI gösterimi
    - _Requirements: 5.4_

  - [x] 11.4 Real-time dashboard

    - Socket.io client entegrasyonu
    - Canlı istatistik güncellemeleri
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 12. Canvas Entegrasyonu

  - [x] 12.1 Rezerve masa gösterimi

    - Rezerve masaları farklı renkte göster
    - Müşteri adı ve kişi sayısı overlay
    - _Requirements: 8.1, 8.3_

  - [x] 12.2 Masa tıklama ile rezervasyon detayı

    - Side panel ile detay gösterimi
    - Hızlı düzenleme seçenekleri

    - _Requirements: 8.2_

  - [x] 12.3 Real-time check-in gösterimi

    - Check-in olan masaları yeşil yap
    - Socket.io ile canlı güncelleme
    - _Requirements: 8.4_

-

- [x] 13. Final Checkpoint - Tüm testlerin geçtiğinden emin ol

  - Ensure all tests pass, ask the user if questions arise.
