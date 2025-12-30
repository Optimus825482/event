# Implementation Plan: Check-in Module

## Overview

Bu plan, Check-in modülünün frontend implementasyonunu kapsar. Backend API'ler zaten mevcut (reservations modülü), bu nedenle odak frontend bileşenleri, state management ve offline desteği üzerinedir.

## Tasks

- [x] 1. Check-in Store ve API Layer Kurulumu

  - [x] 1.1 Check-in Zustand store oluştur (`frontend/src/store/check-in-store.ts`)

    - selectedEventId, selectedEvent, reservations cache
    - eventStats, checkInHistory, offlineQueue state'leri
    - isOnline, soundEnabled ayarları
    - _Requirements: 1.1, 1.2, 5.1_

  - [x] 1.2 Check-in API fonksiyonlarını ekle (`frontend/src/lib/api.ts`)

    - getActiveEvents(): Bugünün aktif etkinliklerini getir
    - getEventForCheckIn(eventId): Etkinlik detayları ve rezervasyonları
    - checkIn(qrCodeHash): QR kod ile check-in
    - searchForCheckIn(query, eventId): Manuel arama
    - registerWalkIn(data): Walk-in kayıt
    - getCheckInHistory(eventId): Check-in geçmişi
    - _Requirements: 1.1, 2.1, 4.1, 11.1_

  - [ ]\* 1.3 Property test: Event data loading correctness
    - **Property 1: Event Selection Loads Correct Data**
    - **Validates: Requirements 1.2, 1.4**

- [x] 2. Offline Support Altyapısı

  - [x] 2.1 IndexedDB wrapper oluştur (`frontend/src/lib/check-in-db.ts`)

    - idb kütüphanesi ile database setup
    - events, offlineQueue, settings stores
    - CRUD operasyonları
    - _Requirements: 8.1, 8.6_

  - [x] 2.2 Offline queue manager oluştur (`frontend/src/lib/offline-check-in-queue.ts`)

    - addToQueue(checkIn): Offline check-in ekle
    - syncQueue(): Bekleyen check-in'leri senkronize et
    - getQueueStatus(): Kuyruk durumu
    - clearSynced(): Senkronize edilenleri temizle
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ]\* 2.3 Property test: Offline queue round-trip
    - **Property 11: Offline Queue Round-trip**
    - **Validates: Requirements 8.1, 8.2, 8.5, 8.6**

- [x] 3. Checkpoint - Store ve Offline Altyapısı

  - Store ve offline altyapısı tamamlandı

- [x] 4. Core UI Components

  - [x] 4.1 EventSelectorModal komponenti oluştur (`frontend/src/components/check-in/EventSelectorModal.tsx`)

    - Aktif etkinlik listesi
    - Etkinlik seçimi ve onay
    - Loading ve empty state'ler
    - _Requirements: 1.1, 1.3_

  - [x] 4.2 GuestCard komponenti oluştur (`frontend/src/components/check-in/GuestCard.tsx`)

    - Misafir bilgileri (isim, telefon, email)
    - Rezervasyon detayları (masa, kişi sayısı, durum)
    - VIP ve Blacklist badge'leri
    - Check-in butonu
    - Kişi sayısı güncelleme
    - _Requirements: 2.2, 3.4, 3.5, 12.1_

  - [x] 4.3 EventStatsDashboard komponenti oluştur (`frontend/src/components/check-in/EventStatsDashboard.tsx`)

    - Toplam beklenen, giriş yapan, kalan sayıları
    - Progress bar (yüzde gösterimi)
    - İptal ve no-show sayıları
    - Real-time güncelleme desteği
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 4.4 Property test: Event stats calculation

    - **Property 8: Event Stats Calculation**
    - **Validates: Requirements 5.1, 5.3, 5.4**

- [x] 5. QR Scanner ve Check-in Flow

  - [x] 5.1 QRScannerPanel komponenti oluştur (`frontend/src/components/check-in/QRScannerPanel.tsx`)

    - Mevcut QRScanner komponenti entegrasyonu
    - Scan sonrası GuestCard gösterimi
    - Check-in onay flow'u
    - Hata durumları (duplicate, cancelled, wrong event)
    - _Requirements: 2.1, 2.3, 2.5, 2.6_

  - [x] 5.2 Check-in işlem fonksiyonlarını implement et

    - performCheckIn(qrCodeHash): Ana check-in fonksiyonu (store'da)
    - validateQRCode(hash): QR kod doğrulama (store'da)
    - handleCheckInResult(result): Sonuç işleme (store'da)
    - _Requirements: 2.3, 3.1, 3.2_

  - [ ]\* 5.3 Property test: Check-in state transition

    - **Property 3: Check-in State Transition Integrity**
    - **Validates: Requirements 2.3, 3.1**

  - [ ]\* 5.4 Property test: Duplicate check-in detection
    - **Property 4: Duplicate Check-in Detection**
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. Checkpoint - QR Scanner Flow

  - QR Scanner flow tamamlandı

- [x] 7. Manual Search ve History

  - [x] 7.1 ManualSearchPanel komponenti oluştur (`frontend/src/components/check-in/ManualSearchPanel.tsx`)

    - Arama input'u (isim veya telefon)
    - Sonuç listesi
    - Rezervasyon seçimi
    - Empty state
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]\* 7.2 Property test: Search result filtering

    - **Property 7: Search Result Filtering**
    - **Validates: Requirements 4.1, 4.2, 4.6**

  - [x] 7.3 CheckInHistoryPanel komponenti oluştur (`frontend/src/components/check-in/CheckInHistoryPanel.tsx`)

    - Son 20 check-in listesi
    - Kronolojik sıralama (en yeni üstte)
    - Entry detayları (isim, masa, saat, kişi)
    - Entry tıklama ile detay görüntüleme
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]\* 7.4 Property test: Check-in history ordering
    - **Property 9: Check-in History Ordering**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. Table Locator ve Walk-in

  - [x] 8.1 TableLocatorModal komponenti oluştur (`frontend/src/components/check-in/TableLocatorModal.tsx`)

    - Venue haritası görüntüleme (canvas ile)
    - Seçili masayı vurgulama
    - Masa etiketi ve yön tarifi
    - Kapatma ve scanner'a dönüş
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 8.2 WalkInRegistrationPanel komponenti oluştur (`frontend/src/components/check-in/WalkInRegistrationPanel.tsx`)

    - Misafir adı input (zorunlu)
    - Kişi sayısı input (zorunlu)
    - Telefon input (opsiyonel)
    - Müsait masa seçimi
    - Kayıt ve check-in butonu
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x]\* 8.3 Property test: Walk-in registration validation

    - **Property 12: Walk-in Registration Validation**
    - **Validates: Requirements 11.2, 11.3, 11.4**

  - [x]\* 8.4 Property test: Guest count capacity validation
    - **Property 13: Guest Count Capacity Validation**
    - **Validates: Requirements 12.3, 12.4, 12.5**

- [x] 9. Checkpoint - Tüm Paneller

  - Tüm paneller tamamlandı

- [x] 10. Feedback ve Indicators

  - [x] 10.1 SoundFeedback utility oluştur (`frontend/src/lib/sound-feedback.ts`)

    - Success, error, VIP, warning sesleri
    - Ses açma/kapama toggle
    - Web Audio API fallback
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 10.2 Visual feedback animasyonları ekle

    - Success animation (yeşil) - QRScannerPanel'de
    - Error animation (kırmızı) - QRScannerPanel'de
    - VIP animation (altın) - QRScannerPanel'de
    - CSS animations kullanıldı
    - _Requirements: 9.6, 9.7_

  - [x] 10.3 OfflineIndicator komponenti oluştur (`frontend/src/components/check-in/OfflineIndicator.tsx`)
    - Online/offline durum göstergesi
    - Bekleyen sync sayısı
    - Manuel sync butonu
    - _Requirements: 8.3, 8.4_

- [x] 11. Ana Sayfa Entegrasyonu

  - [x] 11.1 Check-in page'i yeniden yaz (`frontend/src/app/check-in/page.tsx`)

    - Tab navigation (Scanner, Search, History, Walk-in)
    - Event selector entegrasyonu
    - Stats dashboard entegrasyonu
    - Responsive layout
    - _Requirements: 10.1, 10.4_

  - [x] 11.2 WebSocket real-time entegrasyonu

    - Socket.io client bağlantısı
    - check-in-update event listener
    - stats-update event listener
    - Reconnection handling
    - _Requirements: 5.2, 5.5_

  - [x] 11.3 PWA optimizasyonları
    - Service worker cache stratejisi (check-in page, API, sounds)
    - App shell caching
    - Offline fallback
    - PWA hook entegrasyonu
    - _Requirements: 10.2, 10.5_

- [x] 12. Final Checkpoint
  - [x] Tüm TypeScript diagnostics geçiyor (0 hata)
  - [x] Frontend bileşenleri tamamlandı (14 dosya)
  - [x] Backend endpoint'leri eklendi (5 yeni endpoint)
  - [x] WebSocket real-time entegrasyonu tamamlandı
  - [x] PWA cache stratejisi optimize edildi
  - [ ] Manuel test: QR scan → check-in → table location flow
  - [ ] Manuel test: Offline mode → sync flow
  - [ ] Manuel test: Walk-in registration flow

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Mevcut backend API'ler kullanılacak, yeni endpoint gerekirse backend'e eklenecek
- html5-qrcode kütüphanesi zaten projede mevcut
- Zustand ve IndexedDB (idb) kütüphaneleri kullanılacak

## Completed Files

### Frontend

- `frontend/src/store/check-in-store.ts` - Zustand store
- `frontend/src/lib/api.ts` - checkInApi eklendi
- `frontend/src/lib/check-in-db.ts` - IndexedDB wrapper
- `frontend/src/lib/offline-check-in-queue.ts` - Offline queue manager
- `frontend/src/lib/sound-feedback.ts` - Ses geri bildirimi
- `frontend/src/components/check-in/EventSelectorModal.tsx`
- `frontend/src/components/check-in/GuestCard.tsx`
- `frontend/src/components/check-in/EventStatsDashboard.tsx`
- `frontend/src/components/check-in/QRScannerPanel.tsx`
- `frontend/src/components/check-in/ManualSearchPanel.tsx`
- `frontend/src/components/check-in/CheckInHistoryPanel.tsx`
- `frontend/src/components/check-in/TableLocatorModal.tsx`
- `frontend/src/components/check-in/WalkInRegistrationPanel.tsx`
- `frontend/src/components/check-in/OfflineIndicator.tsx`
- `frontend/src/components/check-in/index.ts` - Export barrel
- `frontend/src/app/check-in/page.tsx` - Ana sayfa

### Backend

- `backend/src/modules/reservations/reservations.controller.ts` - Yeni endpoint'ler
- `backend/src/modules/reservations/reservations.service.ts` - Yeni metodlar
- `backend/src/modules/events/events.controller.ts` - getActiveEventsToday
- `backend/src/modules/events/events.service.ts` - getActiveEventsToday
