# EventFlow PRO - Proje Özeti

## Amaç
EventFlow PRO, etkinlik organizasyonu ve yönetimi için kapsamlı bir full-stack uygulamasıdır. Etkinlik planlamasından rezervasyon yönetimine, personel atamasına ve check-in işlemlerine kadar tüm süreçleri tek bir platformda birleştirir.

## Temel Özellikler

### Etkinlik Yönetimi
- Etkinlik oluşturma ve düzenleme (tarih, konum, kapasite)
- Mekan şablonları ve masa düzeni
- Davetiyenin oluşturma ve yönetimi
- Etkinlik detayları ve notlar

### Rezervasyon Sistemi
- Masa seçimi ve rezervasyon oluşturma
- Müşteri kaydı ve CRM entegrasyonu
- QR kod oluşturma ve check-in
- Rezervasyon durumu takibi (bekli, onaylandı, iptal)

### Personel ve Ekip Yönetimi
- Personel kaydı ve profil yönetimi
- Ekip oluşturma ve atama
- Otomatik personel-masa atama algoritmaları (balanced, zone, random)
- Masa grupları ve ekip-masa ilişkileri

### Check-in Sistemi
- QR kod ile hızlı check-in
- Masa bazlı check-in
- Gerçek zamanlı güncellemeler (WebSocket)

### Mekan Yönetimi
- Mekan şablonları (venue templates)
- Servis noktaları (service points)
- Masa düzeni ve gruplandırma
- Görsel mekan düzeni (canvas tabanlı)

## Kullanıcı Rolleri

### Admin
- Tüm sistem yönetimi
- Kullanıcı ve yetki yönetimi
- Organizasyon ayarları

### Leader (Etkinlik Yöneticisi)
- Etkinlik oluşturma ve yönetimi
- Personel atama
- Rezervasyon takibi
- Raporlama ve analiz

### Check-in Operatörü
- QR kod okuma
- Masa bazlı check-in
- Müşteri doğrulama

## Teknoloji Stack

### Backend
- **Framework:** NestJS 11.x
- **Dil:** TypeScript 5.9
- **Veritabanı:** PostgreSQL (TypeORM)
- **API:** RESTful API
- **Authentication:** JWT + Passport
- **WebSocket:** Socket.IO
- **API Dokümantasyonu:** Swagger

### Frontend
- **Framework:** Next.js 16 (App Router, React 19)
- **Dil:** TypeScript 5
- **UI Kütüphanesi:** Radix UI (shadcn UI benzeri)
- **Styling:** Tailwind CSS 4
- **State Yönetimi:** Zustand
- **Veri Çekme:** TanStack Query + Axios
- **Canvas:** Konva + react-konva
- **QR Kod:** html5-qrcode
- **Fonts:** Geist Sans & Geist Mono

### DevOps
- **Containerization:** Docker + Docker Compose
- **Platform:** Coolify desteği
- **Deployment:** Multi-stage Docker builds
- **Environment:** .env yönetimi

## Önemli Teknik Kararlar

1. **Modüler Mimari:** Backend NestJS modüler yapısı, frontend Next.js App Router
2. **Type Safety:** Tüm stack'te TypeScript kullanımı
3. **API Caching:** Frontend tarafında basit in-memory cache (60s TTL)
4. **Real-time:** Socket.IO ile WebSocket tabanlı güncellemeler
5. **Responsive Design:** Mobile-first yaklaşımı, Tailwind CSS
6. **Security:** JWT authentication, rate limiting, helmet, CORS
7. **Database:** TypeORM ile PostgreSQL entegrasyonu, migration desteği
8. **Canvas-based UI:** Konva ile görsel mekan düzeni
9. **QR Code Sistemi:** html5-qrcode ile QR kod oluşturma ve okuma
10. **Auto-assignment:** Personel-masa atama için algoritmalar

## Performans Hedefleri

- Backend response time: < 100ms (p95)
- Frontend bundle size: < 200KB (gzipped)
- Database query time: < 100ms (p95)
- Cache hit rate: > 90%
- WebSocket latency: < 50ms (P99)

## Önemi

EventFlow PRO, etkinlik organizasyonu için modern, ölçeklenebilir ve kullanıcı dostu bir çözüm sunar. Etkinlik planlamasından check-in işlemlerine kadar tüm süreçleri otomatikleştirir ve operasyonel verimliliğini artırır.
