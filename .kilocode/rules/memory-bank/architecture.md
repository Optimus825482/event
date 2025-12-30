# EventFlow PRO - Sistem Mimarisı

## Genel Mimari

EventFlow PRO, modern bir full-stack mimarisi kullanır. Backend NestJS modüler yapısı, frontend Next.js App Router yapısı üzerine kurulmuştur. Tüm stack'te TypeScript kullanılarak type safety sağlanmaktadır.

## Backend Mimarisı

### Modüler Yapı

Backend, NestJS modüler mimarisi kullanır. Her modül bağımsız olarak çalışabilir ve kendi entity'lerini, controller'larını, service'lerini ve repository'lerini içerir.

**Modüller:**
- `AuthModule` - Kimlik doğrulama ve yetkilendirme
- `UsersModule` - Kullanıcı yönetimi
- `CustomersModule` - Müşteri yönetimi (CRM)
- `EventsModule` - Etkinlik yönetimi
- `ReservationsModule` - Rezervasyon işlemleri
- `VenuesModule` - Mekan şablonları
- `TablesModule` - Masa tipleri
- `StaffModule` - Personel yönetimi
- `RealtimeModule` - WebSocket ile gerçek zamanlı güncellemeler
- `SettingsModule` - Sistem ayarları
- `UploadModule` - Dosya yükleme
- `InvitationsModule` - Davetiye sistemi
- `LeaderModule` - Etkinlik yöneticisi işlemleri
- `AdminModule` - Admin işlemleri
- `NotificationsModule` - Bildirim sistemi
- `HealthModule` - Sistem sağlık kontrolleri

### Entity Yapısı

TypeORM ile PostgreSQL veritabanı kullanılır. Tüm entity'ler `backend/src/entities/` klasöründe tanımlanmıştır.

**Temel Entity'ler:**
- `User` - Kullanıcı bilgileri
- `Customer` - Müşteri bilgileri
- `Event` - Etkinlik bilgileri
- `Reservation` - Rezervasyon bilgileri
- `TableType` - Masa tipleri
- `VenueTemplate` - Mekan şablonları
- `StaffAssignment` - Personel-masa atamaları
- `ServiceTeam` - Servis ekipleri
- `SystemSettings` - Sistem ayarları
- `StaffColor` - Personel renkleri
- `InvitationTemplate` - Davetiye şablonları
- `EventInvitation` - Etkinlik davetileri
- `GuestNote` - Misafir notları
- `TableGroup` - Masa grupları
- `StaffRole` - Personel rolleri
- `WorkShift` - Çalışma vardiyaları
- `Team` - Ekipler
- `EventStaffAssignment` - Etkinlik-personel atamaları
- `OrganizationTemplate` - Organizasyon şablonları
- `Staff` - Personel bilgileri
- `Position` - Pozisyonlar
- `Department` - Departmanlar
- `WorkLocation` - Çalışma yerleri
- `DepartmentPosition` - Departman-pozisyon ilişkileri
- `DepartmentLocation` - Departman-yer ilişkileri
- `ServicePoint` - Servis noktaları
- `ServicePointStaffAssignment` - Servis noktası-personel atamaları
- `EventExtraStaff` - Etkinlik ekstra personeli
- `StaffPerformanceReview` - Personel performans değerlendirmeleri
- `Notification` - Bildirimler
- `NotificationRead` - Bildirim okuma durumları

### API Tasarımı

RESTful API tasarımı kullanılır. Tüm endpoint'ler `/api` prefix'i altında gruplandırılmıştır.

**API Yapısı:**
```
/api/auth/*          - Kimlik doğrulama
/api/users/*        - Kullanıcı yönetimi
/api/customers/*    - Müşteri yönetimi
/api/events/*        - Etkinlik yönetimi
/api/reservations/* - Rezervasyon işlemleri
/api/venues/*       - Mekan şablonları
/api/tables/*        - Masa tipleri
/api/staff/*         - Personel yönetimi
/api/settings/*      - Sistem ayarları
/api/upload/*        - Dosya yükleme
/api/invitations/*   - Davetiye sistemi
/api/notifications/* - Bildirim sistemi
/api/health/*        - Sistem sağlık kontrolleri
```

### Middleware'ler

- **Compression**: gzip/deflate ile response sıkıştırma
- **Helmet**: HTTP güvenlik başlıkları
- **CORS**: Cross-origin resource sharing
- **ValidationPipe**: Global validasyon
- **GlobalExceptionFilter**: Global hata yönetimi
- **ResponseTimeInterceptor**: Yanıt süresi takibi
- **ThrottlerGuard**: Rate limiting

### WebSocket

Socket.IO ile gerçek zamanlı güncellemeler sağlanır. Etkinlik sırasında masa doluluğu, rezervasyon durumu değişiklikleri gibi güncellemeler tüm operatörlere anlık iletilir.

### Güvenlik

- **JWT Authentication**: Token tabanlı kimlik doğrulama
- **Passport**: Authentication stratejisi
- **Role-Based Access Control (RBAC)**: Kullanıcı rolleri (Admin, Leader, Check-in Operatörü)
- **Rate Limiting**: 100 istek / 60 saniye (genel), 10 istek / 60 saniye (auth)
- **Helmet**: HTTP başlıkları
- **CORS**: Cross-origin resource sharing

## Frontend Mimarisı

### Next.js App Router

Next.js 16 (React 19) App Router yapısı kullanılır. Server Components ve Client Components ayrımı mevcuttur.

**Sayfa Yapısı:**
```
/app/page.tsx              - Ana sayfa
/app/login/page.tsx         - Giriş sayfası
/app/register/page.tsx      - Kayıt sayfası
/app/select-module/page.tsx - Modül seçimi
/app/admin/*               - Admin paneli
/app/leader/*             - Etkinlik yöneticisi paneli
/app/check-in/*           - Check-in paneli
```

### Component Yapısı

Radix UI (shadcn UI benzeri) component kütüphanesi kullanılır. Component'ler `frontend/src/components/` klasöründe organize edilmiştir.

**Temel Component'ler:**
- `providers.tsx` - Global providers (Zustand, TanStack Query)
- `error-boundary.tsx` - Hata sınırı
- `canvas/CanvasErrorBoundary.tsx` - Canvas hata sınırı
- `invitations/InvitationEditor.tsx` - Davetiye editörü
- `invitations/InvitationActionsModal.tsx` - Davetiye aksiyon modal'ı
- `reservations/TableSelectionCanvas.tsx` - Masa seçimi canvas'ı
- `team-organization/EventAssignmentTab.tsx` - Etkinlik atama sekmesi
- `team-organization/PersonnelTab.tsx` - Personel sekmesi
- `team-organization/TeamsTab.tsx` - Ekip sekmesi
- `venue/ServicePointElement.tsx` - Servis noktası elementi
- `venue/ServicePointModal.tsx` - Servis noktası modal'ı

### State Yönetimi

Zustand ile global state yönetimi yapılır. TanStack Query + Axios ile API çağrıları ve caching sağlanır.

**API Client:**
- `frontend/src/lib/api.ts` - Axios interceptor ile request/response handling
- In-memory cache (60s TTL) ile API caching
- Auth header'ları otomatik olarak eklenir

### Styling

Tailwind CSS 4 ile responsive tasarım yapılır. Dark mode desteği mevcuttur.

### Canvas

Konva + react-konva ile canvas tabanlı bileşenler geliştirilir. `TableSelectionCanvas` bileşeni ile masalar görsel olarak seçilebilir.

### QR Kod

html5-qrcode ile QR kod oluşturma ve okuma desteği sağlanır.

## Veri Akışı

### Backend Veri Akışı

```
Database (TypeORM) → Repository → Service → Controller → API
    ↑                                              |
    └──────────── Validation at each layer ────────┘
```

### Frontend Veri Akışı

```
API Client (Axios + Cache) → TanStack Query → Component → UI
    ↑                                              |
    └──────────── Validation at each layer ────────┘
```

### WebSocket Veri Akışı

```
Backend Event → Socket.IO → Frontend Component
    ↓                                          |
    └──────────── Real-time updates ────────┘
```

## Önemli Teknik Kararlar

1. **Modüler Mimari**: Backend NestJS modüler yapısı, frontend Next.js App Router
2. **Type Safety**: Tüm stack'te TypeScript kullanımı
3. **RESTful API**: Backend'de RESTful API tasarımı
4. **API Caching**: Frontend tarafında basit in-memory cache (60s TTL)
5. **Real-time**: Socket.IO ile WebSocket tabanlı güncellemeler
6. **Responsive Design**: Mobile-first yaklaşımı, Tailwind CSS
7. **Security**: JWT authentication, rate limiting, helmet, CORS
8. **Database**: TypeORM ile PostgreSQL entegrasyonu
9. **Canvas-based UI**: Konva ile görsel mekan düzeni
10. **QR Code Sistemi**: html5-qrcode ile QR kod oluşturma ve okuma

## Performans Hedefleri

- Backend response time: < 100ms (p95)
- Frontend bundle size: < 200KB (gzipped)
- Database query time: < 100ms (p95)
- Cache hit rate: > 90%
- WebSocket latency: < 50ms (P99)
