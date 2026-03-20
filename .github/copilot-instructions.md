# EventFlow PRO – Copilot Instructions

## Architecture

Monorepo: NestJS backend + Next.js 16 frontend, PostgreSQL database.

```
backend/src/
  modules/     # auth, events, reservations, staff, venues, invitations,
               # realtime, notifications, leader, admin, excel-import, upload…
  entities/    # TypeORM entities — UUIDs as PK, snake_case table names, export from index.ts
  migrations/  # TypeORM migrations — NEVER use synchronize:true
  config/      # typeorm.config.ts (DataSource for CLI), env.validation.ts
  common/      # GlobalExceptionFilter, ResponseTimeInterceptor, shared DTOs

frontend/src/
  app/         # Next.js App Router — (events), (reservations), admin, leader, check-in, login
  components/  # Radix UI + shadcn/ui pattern — key: TableSelectionCanvas, InvitationEditor,
               #   EventAssignmentTab, PersonnelTab, TeamsTab, ServicePointModal
  store/       # Zustand — auth-store, canvas-store, notification-store, settings-store
  lib/         # api.ts — axios instance + in-memory cache (60s TTL), auth header inject
  types/       # Shared TypeScript types

diagrams/      # .mmd files — 01-event-creation-flow, 02-reservations-module, 03-staff-management
```

## User Roles

| Role                  | Access                                     | Key Module  |
| --------------------- | ------------------------------------------ | ----------- |
| **Admin**             | Full system, user/org management           | `admin/`    |
| **Leader**            | Event create/manage, staff assign, reports | `leader/`   |
| **Check-in Operator** | QR scan, table check-in only               | `check-in/` |

## Key Domain Entities

**Ilişki zinciri:**

```
Event → Reservation → Customer (CRM)
Event → VenueTemplate (JSONB canvas layout) → TableGroup → StaffAssignment
Staff → Department / Position → ServiceTeam → EventStaffAssignment
EventInvitation → InvitationTemplate → QR code (qrcode lib)
```

**Tüm entity'ler** (`backend/src/entities/`):
`User`, `Customer`, `Event`, `Reservation`, `TableType`, `VenueTemplate`,
`StaffAssignment`, `ServiceTeam`, `SystemSettings`, `StaffColor`,
`InvitationTemplate`, `EventInvitation`, `GuestNote`, `TableGroup`,
`StaffRole`, `WorkShift`, `Team`, `EventStaffAssignment`, `OrganizationTemplate`,
`Staff`, `Position`, `Department`, `WorkLocation`, `DepartmentPosition`,
`DepartmentLocation`, `ServicePoint`, `ServicePointStaffAssignment`,
`EventExtraStaff`, `StaffPerformanceReview`, `Notification`, `NotificationRead`

## API Routes

Tüm endpoint'ler `/api` prefix'i altında:

```
/api/auth/*          # Kimlik doğrulama
/api/users/*         # Kullanıcı yönetimi
/api/customers/*     # Müsteri / CRM
/api/events/*        # Etkinlik yönetimi
/api/reservations/*  # Rezervasyon islemleri
/api/venues/*        # Mekan sablonları
/api/staff/*         # Personel yönetimi
/api/invitations/*   # Davetiye sistemi
/api/notifications/* # Bildirim sistemi
/api/upload/*        # Dosya yükleme
/api/settings/*      # Sistem ayarları
/api/health/*        # Saglik kontrolleri
/api/docs            # Swagger (dev only)
```

## Build & Test

```bash
# Backend (port 4000)
cd backend && npm install && npm run start:dev

# Frontend (port 3000)
cd frontend && npm install && npm run dev

# Tests
cd backend && npm test           # Jest --runInBand
cd frontend && npm run test:run  # vitest run

# Migrations
cd backend
npm run migration:generate       # yeni migration üret
npm run migration:run            # uygula
npm run migration:revert         # geri al
```

## Code Style

- **Backend**: NestJS 11, class-validator DTOs, `@ApiProperty()` on all DTO fields, UUIDs for PKs
- **Frontend**: React 19, Tailwind, `cn()` helper (`clsx` + `tailwind-merge`), Radix UI primitives
- **State**: Zustand — one store per domain in `frontend/src/store/`
- **API**: `axios` via `lib/api.ts`, TanStack Query for server state, Socket.io for real-time

## Project Conventions

- New backend feature → NestJS module under `backend/src/modules/` (module/controller/service/dto)
- New entity → `backend/src/entities/`, export from `index.ts`, add to `AppModule` entity list, **then generate migration**
- Canvas-based venue layout stored as JSONB in `Event.venueLayout` — edit via Konva/react-konva
- Personel-masa atama algoritmaları: `balanced`, `zone`, `random` — `StaffModule` içinde
- File uploads: `UploadModule` (Multer + Sharp) → `backend/uploads/{avatars,event-images,invitation-images,logos}`
- Add new env vars to `backend/src/config/env.validation.ts` first (class-validator schema)
- Frontend build: `next build --webpack` (Turbopack sorunları nedeniyle)
- DB connection pool: max 50, min 10 — `DB_POOL_MAX` / `DB_POOL_MIN` env vars
- Slow query logging: 500ms esigi — `SLOW_QUERY_THRESHOLD` env var

## Key Frontend Components

```
components/reservations/TableSelectionCanvas.tsx    # Konva canvas — masa secimi
components/invitations/InvitationEditor.tsx         # Davetiye editörü
components/team-organization/EventAssignmentTab.tsx # Drag-drop personel atama
components/team-organization/PersonnelTab.tsx       # Personel listesi
components/team-organization/TeamsTab.tsx           # Ekip yönetimi
components/venue/ServicePointModal.tsx              # Servis noktası
```

**Veri akısı:**

```
API (axios + 60s cache) → TanStack Query → Zustand (global) → Component → UI
Backend Event → Socket.IO → RealtimeModule → Frontend component (real-time)
```

## Integration Points

| Service      | Details                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| Database     | PostgreSQL 5432 — `DB_HOST/PORT/USERNAME/PASSWORD/NAME` env vars                     |
| Auth         | JWT (HS256) + Passport — `JwtAuthGuard`, `LocalAuthGuard`                            |
| WebSocket    | Socket.io — backend port 4000, `RealtimeModule`                                      |
| Swagger      | `/api/docs` (dev only)                                                               |
| Static Files | NestJS `ServeStaticModule` → `backend/uploads/`                                      |
| PWA          | `@ducanh2912/next-pwa` — `frontend/public/manifest.json`                             |
| Email        | `nodemailer` — `MailModule`                                                          |
| Excel        | `backend/modules/excel-import/` + `backend/excel-viewer-pro/` (ayri Vite uygulaması) |

## Security

- `@UseGuards(JwtAuthGuard)` + `@Roles()` + `RolesGuard` — tüm korumalı route'lara ekle
- `CORS_ORIGINS` env var (virgülle ayrılmıs) — hardcode etme
- Helmet: production'da aktif, dev'de CSP kapalı
- Rate limiting: `@nestjs/throttler` — genel 200 istek/60s, auth 10 istek/60s
- `JWT_SECRET` env var — asla hardcode etme

## Environment Variables

| Degisken                              | Acıklama                          | Varsayılan              |
| ------------------------------------- | --------------------------------- | ----------------------- |
| `NODE_ENV`                            | development / production          | —                       |
| `PORT`                                | Backend port                      | 4000                    |
| `DB_HOST/PORT/USERNAME/PASSWORD/NAME` | PostgreSQL baglantısı             | localhost/5432/postgres |
| `JWT_SECRET`                          | JWT imzalama anahtarı             | **zorunlu**             |
| `CORS_ORIGINS`                        | Izin verilen originler (virgülle) | —                       |
| `NEXT_PUBLIC_API_URL`                 | Frontend → Backend URL            | —                       |
| `DB_POOL_MAX` / `DB_POOL_MIN`         | Connection pool limitleri         | 50 / 10                 |
| `SLOW_QUERY_THRESHOLD`                | Yavas sorgu log esigi (ms)        | 500                     |
| `THROTTLE_TTL` / `THROTTLE_LIMIT`     | Rate limit pencere (ms) / istek   | 60000 / 200             |

## Current State

_Son güncelleme: 2026-02-21_

- Tüm temel modüller tamamlandı (auth, events, reservations, staff, venues, invitations, check-in)
- Canvas tabanlı mekan düzeni ve personel atama algoritmaları aktif
- `excel-import` modülü ve `excel-viewer-pro` araçları mevcut
- Deployment: Docker + Coolify — `docker-compose.coolify.yml`
