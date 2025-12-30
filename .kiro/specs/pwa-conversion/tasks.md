# Implementation Plan: PWA Conversion

## Overview

EventFlow PRO uygulamasının Progressive Web App (PWA) olarak dönüştürülmesi için implementasyon planı. @ducanh2912/next-pwa kütüphanesi kullanılarak modern PWA standartlarına uygun bir yapı oluşturulacaktır.

## Tasks

- [ ] 1. PWA Temel Altyapısı

  - [ ] 1.1 @ducanh2912/next-pwa paketini yükle
    - `npm install @ducanh2912/next-pwa` komutu ile kurulum
    - package.json'da dependency kontrolü
    - _Requirements: 2.1_
  - [ ] 1.2 Web App Manifest dosyasını oluştur
    - `frontend/public/manifest.json` dosyası oluştur
    - name, short_name, description, start_url, display, theme_color, background_color, icons alanlarını ekle
    - Mevcut android-chrome ikonlarını kullan
    - Maskable icon tanımı ekle
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  - [ ] 1.3 next.config.ts dosyasını PWA için güncelle
    - withPWA wrapper'ı import et ve uygula
    - dest: "public" ayarla
    - Development modda disable et
    - cacheStartUrl ve dynamicStartUrl aktif et
    - Offline fallback konfigürasyonu ekle
    - Runtime caching stratejilerini tanımla
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 2. Metadata ve Layout Güncellemeleri

  - [ ] 2.1 Root layout metadata'sını PWA için güncelle
    - manifest link ekle
    - appleWebApp konfigürasyonu ekle
    - viewport ve themeColor ayarla
    - Open Graph ve Twitter card meta'ları güncelle
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [ ]\* 2.2 Metadata presence property testi yaz
    - **Property 3: Metadata Presence Validation**
    - HTML head içeriğinde gerekli meta tag'lerin varlığını kontrol et
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 3. Offline Fallback Sayfası

  - [ ] 3.1 /~offline route'u oluştur
    - `frontend/src/app/~offline/page.tsx` dosyası oluştur
    - EventFlow PRO logosu göster
    - "Çevrimdışı" mesajı göster
    - İnternet bağlantısı kontrol talimatı ekle
    - "Tekrar Dene" butonu ekle
    - Dark theme uyumlu tasarım
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 4. PWA State Yönetimi

  - [ ] 4.1 PWA Zustand store oluştur
    - `frontend/src/store/pwa-store.ts` dosyası oluştur
    - deferredPrompt, isInstallBannerVisible, isInstalled, isOnline state'leri
    - lastDismissed timestamp yönetimi
    - Action metodları: setDeferredPrompt, showInstallBanner, hideInstallBanner, dismissBanner
    - _Requirements: 6.1, 6.2, 6.4, 6.6_
  - [ ] 4.2 usePWA hook'u oluştur
    - `frontend/src/hooks/usePWA.ts` dosyası oluştur
    - beforeinstallprompt event listener
    - Online/offline event listeners
    - Service worker update detection
    - promptInstall, dismissInstallPrompt, updateServiceWorker metodları
    - _Requirements: 6.1, 6.2, 6.5, 8.1, 8.2, 8.3_
  - [ ]\* 4.3 Online/offline state detection property testi yaz
    - **Property 4: Online/Offline State Detection**
    - Network durumu değişikliklerinin doğru algılandığını test et
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 5. Checkpoint - Temel PWA Altyapısı

  - Tüm testlerin geçtiğinden emin ol
  - `npm run build` ile build al ve sw.js oluştuğunu kontrol et
  - Kullanıcıya soru varsa sor

- [ ] 6. PWA UI Bileşenleri

  - [ ] 6.1 OfflineIndicator bileşeni oluştur
    - `frontend/src/components/pwa/OfflineIndicator.tsx` dosyası oluştur
    - Çevrimdışı durumda banner göster
    - Online olunca otomatik gizle
    - Animasyonlu geçiş efekti
    - _Requirements: 8.2, 8.3_
  - [ ] 6.2 InstallBanner bileşeni oluştur
    - `frontend/src/components/pwa/InstallBanner.tsx` dosyası oluştur
    - Özel kurulum prompt tasarımı
    - "Yükle" ve "Kapat" butonları
    - 7 günlük dismiss cooldown kontrolü
    - Zaten yüklüyse gösterme
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  - [ ] 6.3 PWA bileşenlerini Providers'a entegre et
    - `frontend/src/components/providers.tsx` dosyasını güncelle
    - OfflineIndicator'ı global olarak ekle
    - InstallBanner'ı uygun zamanda göster
    - _Requirements: 6.3, 8.2_

- [ ] 7. Cache Stratejileri ve Güvenlik

  - [ ] 7.1 Runtime caching konfigürasyonunu detaylandır
    - Static assets için Cache First (maxEntries: 100, maxAge: 1 yıl)
    - Images için Cache First (maxEntries: 100, maxAge: 30 gün)
    - API için Stale While Revalidate (maxEntries: 50, maxAge: 24 saat)
    - Fonts için Cache First (maxAge: 1 yıl)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  - [ ]\* 7.2 Cache strategy property testi yaz
    - **Property 2: Cache Strategy Correctness**
    - URL pattern'e göre doğru stratejinin seçildiğini test et
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3, 7.4**
  - [ ] 7.3 Güvenlik önlemlerini uygula
    - Logout'ta hassas cache'leri temizle
    - Auth token'ları cache'leme
    - Same-origin request kontrolü
    - _Requirements: 10.3, 10.4, 10.5_

- [ ] 8. Offline Senkronizasyon

  - [ ] 8.1 Offline queue yönetimi için utility oluştur
    - `frontend/src/lib/offline-queue.ts` dosyası oluştur
    - IndexedDB ile queue yönetimi (idb kütüphanesi kullan)
    - addToQueue, processQueue, clearQueue metodları
    - Exponential backoff retry logic
    - _Requirements: 8.4, 8.5_
  - [ ] 8.2 API client'ı offline-aware yap
    - `frontend/src/lib/api.ts` dosyasını güncelle
    - Network hatalarında queue'ya ekle
    - Online olunca otomatik retry
    - Sync durumu bildirimi
    - _Requirements: 8.4, 8.5, 8.6_

- [ ] 9. Final Checkpoint - Tam PWA Entegrasyonu

  - Tüm testlerin geçtiğinden emin ol
  - Production build al ve test et
  - Lighthouse PWA skorunu kontrol et (hedef: 90+)
  - Kullanıcıya soru varsa sor

- [ ] 10. Manifest ve Build Doğrulama
  - [ ]\* 10.1 Manifest schema validation property testi yaz
    - **Property 1: Manifest Schema Validation**
    - manifest.json dosyasının tüm gerekli alanları içerdiğini test et
    - **Validates: Requirements 1.1-1.11**
  - [ ] 10.2 .gitignore güncellemesi
    - sw.js ve workbox-\*.js dosyalarını .gitignore'a ekle
    - Build artifacts'ları ignore et
    - _Requirements: 4.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Her task spesifik requirements'ları referans eder
- Checkpoint'lar incremental validation sağlar
- Property testleri Vitest + fast-check ile yazılacak
- PWA özellikleri production build'de test edilmeli (development'ta disable)
