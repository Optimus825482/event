# EventFlow PRO Yeniden Kurulum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EventFlow PRO'yu, masa/rezervasyon/atama bütünlüğünü veritabanı kısıtlarıyla garanti eden tek bir Next.js + PostgreSQL uygulaması (`web/`) olarak yeniden kurmak; eski sistemdeki acil açıkları kapatmak.

**Architecture:** `web/` altında Next.js 16 App Router; okuma Sunucu Bileşenlerinde, yazma `defineAction` ile sarılmış Server Action'larda. Drizzle ORM + SQL migration'ları; Better Auth ile çerez oturumu; tek `authorize()` yetki katmanı; canlı güncelleme SSE + `LISTEN/NOTIFY`.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Drizzle ORM/drizzle-kit, `pg`, PostgreSQL 17, Better Auth (+username eklentisi, bcryptjs), Zod, TanStack Query, Zustand, Vitest, fast-check, Playwright, exceljs, sharp, nodemailer.

**Spec:** `docs/superpowers/specs/2026-11-22-eventflow-nextjs-yeniden-kurulum-design.md`

## Global Constraints

- Çalışma dalı: `rebuild/nextjs`. Ajanlar **commit atmaz, push etmez**; her görevi denetleyen ana oturum commit eder.
- Ajanlar yalnızca görevlerinde "Files" altında yazan yolları değiştirir. `web/package.json` bağımlılıkları yalnızca Görev 1'de eklenir; sonradan gereken paket ana oturuma bildirilir.
- Hiçbir kaynak dosya 400 satırı aşmaz. `any`, `@ts-ignore`, `eslint-disable`, `console.*` (betikler hariç) yok.
- Veritabanı: tüm adlar `snake_case`; PK `uuid default gen_random_uuid()`; zamanlar `timestamptz`; para `numeric(12,2)` + `currency char(3) default 'TRY'`. Şema yalnızca migration ile değişir.
- Her Server Action `defineAction` ile tanımlanır (Zod girdi + `authorize`). Doğrudan `"use server"` işlevi dışa aktarılmaz.
- Yerel/test veritabanı: `web/.pgdata` içinde özel PostgreSQL kümesi, port `54329`, kullanıcı `postgres`, parola yok (yalnızca localhost). `DATABASE_URL=postgres://postgres@localhost:54329/eventflow_dev`, test: `.../eventflow_test`.
- Doğrulama komutları (hepsi `web/` içinde): `npm run typecheck`, `npm run lint`, `npm test`.
- Açık soruların varsayılanları: NO_SHOW sonrası check-in serbest ve kayıtlı; kara listedeki müşteriye rezervasyon engelli (admin aşabilir); eski saatler `Europe/Istanbul` varsayılır (taşıma betiğinde parametre); Mistral ayrıştırıcı taşınmaz; git geçmişi yeniden yazılmaz; geçiş tek seferlik.
- Arayüz metinleri Türkçe; kod, tablo ve değişken adları İngilizce.

## Review Focus

1. Aynı masaya paralel iki rezervasyon isteği → biri başarılı, diğeri anlaşılır "masa dolu" hatası (500 değil). Test: Görev 4 (kısıt) ve Aşama 3.
2. Yetkisiz rol bir action'ı doğrudan çağırır → `ForbiddenError`, veri değişmez. Test: Görev 6 ve Görev 9.
3. Pasif (`is_active=false`) kullanıcının mevcut oturumu → sonraki istekte reddedilir. Test: Görev 3.
4. Geçersiz UUID veya eksik alan → Zod hatası, veritabanı hata metni istemciye sızmaz. Test: Görev 9.
5. Silinen masanın rezervasyonu/ataması → silme reddedilir (FK `RESTRICT`), yetim kayıt oluşmaz. Test: Görev 4.

---

## Aşama 0 — Eski sistemde acil önlemler

### Görev 0A: Depo temizliği (Haiku)

**Files:**
- Modify: `.gitignore`
- Create: `docs/legacy/schema.sql`
- Delete (yalnızca git index'inden, `git rm --cached`; dosyalar diskte kalır): `personnel_images_correct/`, `exc/`, `backend/uploads/`, `backend/seed-data.sql`, `.claude/settings.local.json`, kökteki `More Actions*.md`, `Ekran görüntüsü*.png`, `image.png`
- Delete (tamamen): `AD.JSON`, `backend/package.json.lnk`, `backend/src/modules/staff/staff.service.ts.bak`, `docker-compose.coolify.yml` (`.yaml` kalır), `frontend/Untitled 3.png`

- [ ] **Step 1:** `backend/seed-data.sql` içinden yalnızca şema ifadelerini (`CREATE`, `ALTER`, `COMMENT`, `SET`; `INSERT` ve `COPY` verisi hariç) `docs/legacy/schema.sql` dosyasına çıkar. Doğrula: `grep -c "^CREATE TABLE" docs/legacy/schema.sql` → `33`; `grep -ci "insert into\|@gmail" docs/legacy/schema.sql` → `0`.
- [ ] **Step 2:** `.gitignore`'a ekle: `personnel_images_correct/`, `exc/`, `*.xlsx`, `*.bak`, `*.lnk`, `*.code-workspace`, `backend/uploads/`, `backend/seed-data.sql` (mevcut `!backend/seed-data.sql` istisnasını kaldır), `web/.pgdata/`, `web/.env*` (`!web/.env.example`), `web/uploads/`.
- [ ] **Step 3:** Yukarıdaki silme işlemlerini uygula. Doğrula: `git ls-files | grep -c "personnel_images_correct\|\.xlsx$\|seed-data"` → `0`; `ls backend/seed-data.sql personnel_images_correct | head -2` dosyaların diskte durduğunu gösterir.

### Görev 0B: Eski backend güvenlik düzeltmeleri (Sonnet)

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/reservations/reservations.controller.ts`, `backend/src/modules/events/events.controller.ts`, `backend/src/modules/health/health.controller.ts`, `backend/src/main.ts`, `backend/src/modules/realtime/realtime.gateway.ts`, `backend/src/modules/upload/upload.service.ts`, `backend/src/common/**/http-exception.filter.ts`, `docker-compose.yml`, `docker-compose.coolify.yaml`
- Test: `backend/src/modules/auth/security-hardening.spec.ts`

- [ ] **Step 1: Başarısız testleri yaz** (`Reflector` ile dekoratör metadata'sı ve saf işlevler üzerinden; veritabanı gerektirmez):
  - `AuthController.register` üzerinde `JwtAuthGuard` + `Roles(ADMIN)` var, public metadata yok.
  - `ReservationsController` içinde `@Public` taşıyan metot sayısı `0`.
  - `EventsController` `active/today` public değil.
  - `HealthController` metrics metodu `Roles(ADMIN)` ister.
  - `UploadService` silme yolu: `"../../etc/passwd"`, `"a/b.webp"`, `"..%2Fx"` girdileri `BadRequestException` atar; `"abc123.webp"` kabul edilir.
  - Hata filtresi: `NODE_ENV=production` iken `new Error("relation \"users\" does not exist")` için yanıt gövdesindeki `message` `"Internal server error"`dır.
  - Gateway `joinUser`: istemci `{ role: "admin" }` gönderse de katıldığı oda, bağlantıda doğrulanan JWT'deki role göredir.
- [ ] **Step 2:** `cd backend && npm ci && npx jest src/modules/auth/security-hardening.spec.ts` → FAIL.
- [ ] **Step 3: Uygula.** Ayrıca: Swagger yalnızca `NODE_ENV !== "production"` iken kurulur; `docker-compose.yml` içinde `DB_PASSWORD` ve `JWT_SECRET` varsayılanları `${VAR:?required}` biçimine çevrilir ve `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `DEFAULT_ADMIN_PASSWORD` geçirilir; `docker-compose.coolify.yaml` içinden PostgreSQL `ports` satırı kaldırılır.
- [ ] **Step 4:** `npx jest src/modules/auth/security-hardening.spec.ts` → PASS; `npx tsc --noEmit` → hatasız.

---

## Aşama 1 — Temel

### Dosya yapısı

```
web/
  scripts/pg.mjs                 özel PostgreSQL kümesi: init | start | stop | reset
  drizzle.config.ts
  drizzle/                       SQL migration'ları
  src/env.ts                     Zod ile ortam doğrulama
  src/db/client.ts               pg Pool + drizzle örneği
  src/db/schema/{auth,catalog,people,events,reservations,staffing,invitations,reviews,system}.ts
  src/db/schema/index.ts
  src/features/auth/{roles.ts,auth.ts,session.ts,policy.ts,errors.ts}
  src/lib/action.ts              defineAction
  src/domain/{event-status.ts,reservation-status.ts}
  src/proxy.ts
  src/app/…                      sayfalar
  src/components/ui/…            eski frontend'den taşınan shadcn bileşenleri
  tests/helpers/db.ts            migrate + truncate
  tests/**                       testler (kaynakla aynı alt yol)
```

### Görev 1: İskelet, yerel veritabanı, test altyapısı (Sonnet)

**Files:** Create: `web/**` (yukarıdaki yapıdan `scripts/pg.mjs`, `drizzle.config.ts`, `src/env.ts`, `src/db/client.ts`, `src/features/auth/roles.ts`, `tests/helpers/db.ts`, `tests/env.test.ts`, `tests/db.test.ts`, `vitest.config.ts`, `.env.example`, `package.json`, yapılandırma dosyaları)

**Interfaces — Produces:**
- `src/env.ts`: `export const env: { DATABASE_URL: string; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; UPLOAD_DIR: string; NODE_ENV: "development"|"test"|"production" }`; `parseEnv(input: Record<string,string|undefined>)` geçersizde atar. `BETTER_AUTH_SECRET` en az 32 karakter.
- `src/db/client.ts`: `export const pool: Pool` (max 20), `export const db` (drizzle, `schema` ile), `export type Db`, `export type Tx`.
- `src/features/auth/roles.ts`: `export const ROLES = ["admin","organizer","staff","leader","controller","venue_owner"] as const; export type Role`.
- `tests/helpers/db.ts`: `setupTestDb(): Promise<void>` (test veritabanını oluşturur, migration'ları uygular), `truncateAll(): Promise<void>`.
- npm betikleri: `dev`, `build`, `typecheck` (`tsc --noEmit`), `lint`, `test` (`vitest run`), `db:start|stop|reset` (`node scripts/pg.mjs …`), `db:generate` (`drizzle-kit generate`), `db:migrate`.

- [ ] **Step 1:** `npx create-next-app@latest web --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-npm --no-turbopack` (etkileşimsiz). `tsconfig` içinde `strict: true`, `noUncheckedIndexedAccess: true`. `next.config.ts`: `output: "standalone"`.
- [ ] **Step 2:** Bağımlılıkları tek seferde kur (sonraki aşamalar dahil): `drizzle-orm pg zod better-auth bcryptjs @tanstack/react-query zustand immer konva react-konva three @react-three/fiber @react-three/drei html5-qrcode idb exceljs sharp nodemailer qrcode sonner lucide-react class-variance-authority clsx tailwind-merge tw-animate-css react-dropzone` ve `frontend/package.json` içindeki tüm `@radix-ui/*` paketleri; dev: `drizzle-kit tsx vitest @vitest/coverage-v8 fast-check @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react @playwright/test @types/pg @types/bcryptjs @types/nodemailer @types/qrcode @types/three`.
- [ ] **Step 3:** `scripts/pg.mjs`: `initdb`/`pg_ctl` ikililerini `PATH`'ten veya `C:\Program Files\PostgreSQL\17\bin` altından bulur; `init` → `initdb -D .pgdata -U postgres -A trust -E UTF8`, `start` → `pg_ctl -D .pgdata -o "-p 54329 -c listen_addresses=localhost" -w start` ardından `eventflow_dev` ve `eventflow_test` yoksa oluşturur; `stop`; `reset` (iki veritabanını düşürüp yeniden oluşturur). Küme zaten çalışıyorsa `start` hata vermez.
- [ ] **Step 4: Başarısız testleri yaz.** `tests/env.test.ts`: 31 karakterlik `BETTER_AUTH_SECRET` reddedilir; `DATABASE_URL` eksikse hata mesajı değişken adını içerir. `tests/db.test.ts`: `setupTestDb()` sonrası `select 1` döner ve `select current_setting('TimeZone')` `UTC`'dir.
- [ ] **Step 5:** Uygula; havuz bağlantısında `options: "-c timezone=UTC"`.
- [ ] **Step 6:** `npm run db:start && npm run typecheck && npm run lint && npm test` → hepsi geçer; `npm run build` → başarılı.

### Görev 2: Durum makineleri (Haiku)

**Files:** Create: `web/src/domain/event-status.ts`, `web/src/domain/reservation-status.ts`, `web/tests/domain/event-status.test.ts`, `web/tests/domain/reservation-status.test.ts`

**Interfaces — Produces:**
- `EVENT_STATUSES = ["draft","published","active","completed","cancelled"] as const`; `canTransitionEvent(from, to): boolean`.
  İzinli geçişler: `draft→published|cancelled`, `published→draft|active|cancelled`, `active→completed|cancelled`. `completed` ve `cancelled` sondur.
- `RESERVATION_STATUSES = ["pending","confirmed","checked_in","cancelled","no_show"] as const`; `ACTIVE_RESERVATION_STATUSES = ["pending","confirmed","checked_in"] as const`; `canTransitionReservation(from, to): boolean`.
  İzinli geçişler: `pending→confirmed|cancelled|no_show|checked_in`, `confirmed→checked_in|cancelled|no_show`, `no_show→checked_in`, `cancelled→confirmed`. `checked_in` sondur.

- [ ] **Step 1:** Tablo güdümlü testler: her iki makine için 5×5 = 25 çiftin tamamı beklenen sonuçla; ayrıca `canTransitionEvent("completed","draft") === false`, `canTransitionReservation("no_show","checked_in") === true`, `canTransitionReservation("checked_in","cancelled") === false`, aynı duruma geçiş her zaman `false`.
- [ ] **Step 2:** `npx vitest run tests/domain` → FAIL. **Step 3:** Uygula. **Step 4:** → PASS.

### Görev 3: Kimlik doğrulama (Opus)

**Files:** Create: `web/src/features/auth/auth.ts`, `session.ts`, `errors.ts`, `web/src/db/schema/auth.ts`, `web/src/app/api/auth/[...all]/route.ts`, `web/src/app/login/page.tsx`, `web/src/app/login/login-form.tsx`, `web/scripts/create-admin.ts`, `web/tests/features/auth/session.test.ts`; Modify: `web/src/db/schema/index.ts`; Create: ilk migration (`npm run db:generate`).

**Interfaces — Consumes:** Görev 1 (`db`, `env`, `ROLES`, test yardımcıları).
**Produces:**
- Tablolar: `users` (Better Auth kullanıcı tablosu; ek alanlar `username` tekil, `role` pg enum `user_role` varsayılan `staff`, `is_active boolean default true`, `staff_id uuid null`, `color text null`), `sessions`, `accounts`, `verifications`. `id` sütunları `uuid`.
- `errors.ts`: `class UnauthenticatedError extends Error`, `class ForbiddenError extends Error`.
- `session.ts`: `type Actor = { id: string; username: string; role: Role; staffId: string | null }`; `getActor(): Promise<Actor | null>` (pasif kullanıcı için `null`); `requireActor(): Promise<Actor>` (yoksa `UnauthenticatedError`).
- `auth.ts`: `export const auth` — `emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, password: { hash, verify } }` (bcryptjs, cost 12); `username()` eklentisi; Drizzle bağdaştırıcısı; oturum süresi 7 gün; hız sınırı açık.
- `scripts/create-admin.ts`: `tsx scripts/create-admin.ts <username> <email>`; parola `ADMIN_PASSWORD` ortam değişkeninden okunur, argümandan değil.

- [ ] **Step 1:** Better Auth'un güncel belgesini Context7 (`/better-auth/better-auth`) ile oku: Drizzle bağdaştırıcısı, `username` eklentisi, uuid kimlik üretimi, `disableSignUp`, sunucuda `auth.api.getSession({ headers })`, programatik kullanıcı oluşturma (`internalAdapter.createUser` + `linkAccount({ providerId: "credential", password: hash })`).
- [ ] **Step 2: Başarısız testler** (`tests/features/auth/session.test.ts`, gerçek test veritabanı):
  - Betikle oluşturulan kullanıcı kullanıcı adı + parola ile giriş yapar; yanıt `httpOnly` oturum çerezi içerir.
  - Yanlış parola reddedilir ve yanıt, kullanıcı adının var olup olmadığını ayırt ettirmez.
  - Herkese açık kayıt ucu (`/api/auth/sign-up/email`) kullanıcı oluşturmaz.
  - Eski sistemden gelen bcrypt hash'i (`bcryptjs.hashSync("EskiParola!2024", 12)` ile `accounts.password`'a doğrudan yazılmış) ile giriş başarılıdır.
  - `is_active=false` yapılan kullanıcının geçerli oturum çereziyle `getActor()` `null` döner.
- [ ] **Step 3:** FAIL gör. **Step 4:** Uygula; giriş sayfası tek form (kullanıcı adı, parola), hata durumunda tek genel mesaj: `Kullanıcı adı veya parola hatalı`. **Step 5:** `npm test && npm run typecheck && npm run lint` → PASS.

### Görev 4: Alan şeması (Opus)

**Files:** Create: `web/src/db/schema/{catalog,people,events,reservations,staffing,invitations,reviews,system}.ts`, migration, `web/tests/db/constraints.test.ts`; Modify: `web/src/db/schema/index.ts`

**Interfaces — Consumes:** Görev 3 (`users`), Görev 2 (durum sabitleri pg enum'larına kaynak olur).
**Produces (tablolar; sütun ayrıntısı için eski karşılığı `backend/src/entities/*.ts` ve `docs/legacy/schema.sql`'den alınır, aşağıdaki farklar bağlayıcıdır):**

- `catalog.ts`: `departments`, `positions`, `work_locations` (`name` tekil, `is_active`), `department_positions`, `department_locations` (çift tekil), `staff_roles`, `table_types`.
- `people.ts`: `staff` (`sicil_no` tekil; `department_id`, `position_id`, `work_location_id` FK null olabilir; `status` enum; `photo_path`), `users.staff_id → staff` FK + tekil, `user_permissions` (`user_id` CASCADE, `module` enum: `events|reservations|check_in|staff|customers|venues|settings|users|invitations|notifications`, `can_view|can_create|can_edit|can_delete`, tekil `(user_id,module)`), `customers` (`phone_normalized` ve `email_normalized` için `WHERE … IS NOT NULL` kısmi tekil index; `is_blacklisted`; `total_spent numeric(12,2)`), `customer_tags` (`customer_id`,`tag` tekil), `guest_notes`.
- `events.ts`: `events` (`organizer_id → users RESTRICT`, `starts_at`, `ends_at`, `CHECK (ends_at IS NULL OR ends_at > starts_at)`, `status` enum, `layout_decor jsonb`), `event_tables` (`event_id` CASCADE, `label`, `table_type_id`, `capacity int CHECK (capacity > 0)`, `x`,`y`,`rotation`, `is_loca boolean`, tekil `(event_id,label)`), `venue_templates`, `service_points`, `work_shifts` (`event_id` null olabilir; tekil ad kapsam başına).
- `reservations.ts`: `reservations` (`event_id → events RESTRICT`, `table_id → event_tables RESTRICT`, `customer_id → customers RESTRICT`, `guest_count int CHECK (guest_count BETWEEN 1 AND 50)`, `status` enum, `qr_token text` tekil, `legacy_qr_hash text` tekil null olabilir, `total_amount`, `currency`, `is_paid`, `checked_in_at`, `checked_in_by → users`), **kısmi tekil index `reservations_active_table_uq` on `(event_id, table_id) WHERE status IN ('pending','confirmed','checked_in')`**, `check_in_events` (`reservation_id`, `idempotency_key text` tekil, `client_timestamp`, `actor_id`, `outcome`).
- `staffing.ts`: `teams` (`event_id` CASCADE, `leader_staff_id`), `team_members` (tekil `(team_id,staff_id)`), `table_groups` (`event_id`, `team_id` SET NULL), `table_group_tables` (`event_id`,`table_id`; **tekil `(event_id,table_id)`**), `event_staff_assignments` (`event_id` CASCADE, `staff_id → staff RESTRICT`, `shift_id`, `team_id`, `assignment_type` enum `table|special_task|service_point`, `service_point_id`, `special_task_*`; **tekil `(event_id,staff_id,shift_id)` `NULLS NOT DISTINCT`**), `assignment_tables` (tekil `(assignment_id,table_id)`), `event_extra_staff`, `organization_templates`.
- `invitations.ts`: `invitation_templates`, `event_invitations`.
- `reviews.ts`: `staff_performance_reviews` (`staff_id → staff`, `reviewer_id → users`, `event_id`; tekil üçlü; `is_completed`), puan kategorileri ayrı sütunlar (`smallint CHECK BETWEEN 0 AND 5`).
- `system.ts`: `system_settings` (`smtp_password_encrypted`), `notifications`, `notification_reads`, `staff_colors`.

- [ ] **Step 1: Başarısız kısıt testleri** (`tests/db/constraints.test.ts`, her biri doğrudan `db.insert` ile):
  - Aynı `(event_id, table_id)` için ikinci `confirmed` rezervasyon `23505` ile reddedilir; ilki `cancelled` yapılınca ikincisi eklenir.
  - **Paralel:** `Promise.allSettled` ile aynı masaya 10 eşzamanlı ekleme → tam olarak 1 `fulfilled`.
  - `guest_count` 0 ve 51 reddedilir; `capacity` 0 reddedilir; `ends_at <= starts_at` reddedilir.
  - Rezervasyonu olan `event_tables` satırı silinemez (`23503`); rezervasyonu olan etkinlik silinemez.
  - Aynı masa aynı etkinlikte ikinci bir gruba eklenemez.
  - Aynı personel aynı etkinlik + vardiyaya iki kez atanamaz; `shift_id` `NULL` iken de atanamaz.
  - Aynı `idempotency_key` ikinci kez eklenemez.
  - Aynı `phone_normalized` ile ikinci müşteri eklenemez; ikisi de `NULL` ise eklenebilir.
  - Tüm tablolarda zaman sütunlarının tipi `timestamp with time zone`'dur (`information_schema.columns` sorgusu; `timestamp without time zone` sayısı `0`).
- [ ] **Step 2:** FAIL gör. **Step 3:** Şemayı yaz, `npm run db:generate`; drizzle-kit'in ifade edemediği kısıtları (kısmi index, `NULLS NOT DISTINCT`, `CHECK`) üretilen SQL'de doğrula, eksikse aynı migration'a elle ekle. **Step 4:** `npm run db:reset && npm test && npm run typecheck` → PASS (boş veritabanından kurulum kanıtı).

### Görev 5: Yetki politikası (Sonnet)

**Files:** Create: `web/src/features/auth/policy.ts`, `web/tests/features/auth/policy.test.ts`

**Interfaces — Consumes:** `Role` (Görev 1), `ForbiddenError` (Görev 3; Görev 3 bitmeden çalışılıyorsa `errors.ts` bu görevde oluşturulur, içerik aynıdır).
**Produces:**
- `type Module = "users"|"settings"|"events"|"venues"|"staff"|"customers"|"invitations"|"reservations"|"check_in"|"reviews"|"notifications"`; `type Verb = "view"|"create"|"edit"|"delete"`.
- `type PermissionRow = { module: Module; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }`.
- `type PolicyActor = { id: string; role: Role; staffId: string | null; permissions?: PermissionRow[] }`.
- `can(actor: PolicyActor, module: Module, verb: Verb, resource?: { ownerId?: string; teamLeaderStaffId?: string }): boolean`
- `authorize(...aynı parametreler): void` — izin yoksa `ForbiddenError`.

Kurallar: (1) `admin` her şeye izinlidir. (2) Rol taban matrisi: `organizer` → `events, venues, staff, customers, invitations, reservations, check_in, reviews, notifications` tüm fiiller; `staff` → `reservations` (view, create, edit), `customers` (view), `check_in` (view, create); `leader` → `check_in` (view, create), `reviews` (view, create, edit; yalnızca `resource.teamLeaderStaffId === actor.staffId`), `notifications` (view); `controller` → `check_in` (view, create); `venue_owner` → `venues` (view, create, edit, delete; yalnızca `resource.ownerId === actor.id`; `resource` yoksa yalnızca `view` ve `create`). (3) `users` ve `settings` yalnızca `admin`. (4) `permissions` içinde ilgili modül satırı varsa sonuç = taban **VE** satırdaki bayrak (izin satırı yalnızca daraltır, asla genişletmez; `admin`'e uygulanmaz).

- [ ] **Step 1:** Tablo güdümlü test: 6 rol × 11 modül × 4 fiil = 264 hücrenin tamamı beklenen değerle; ek olarak: lider başka ekibin değerlendirmesini düzenleyemez; `venue_owner` başkasının şablonunu silemez; `organizer` için `{module:"events", canDelete:false,…}` satırı silmeyi kapatır; `staff` için `{module:"events", canView:true,…}` satırı erişim **açmaz**; `authorize` reddederken `ForbiddenError` atar.
- [ ] **Step 2:** FAIL. **Step 3:** Uygula (matris tek bir sabit nesne). **Step 4:** PASS.

### Görev 6: `defineAction`, rota koruması, uygulama kabuğu (Sonnet)

**Files:** Create: `web/src/lib/action.ts`, `web/src/proxy.ts`, `web/src/app/(app)/layout.tsx`, `web/src/app/(app)/page.tsx`, `web/src/app/{error,not-found,loading}.tsx`, `web/src/components/ui/**` (eski `frontend/src/components/ui` ve `frontend/src/lib/utils.ts`, `frontend/src/app/globals.css` taşınır), `web/src/components/layout/app-nav.tsx`, `web/tests/lib/action.test.ts`, `web/tests/lint/actions-use-define-action.test.ts`

**Interfaces — Consumes:** `getActor`, `requireActor`, hata sınıfları (Görev 3); `authorize`, `can`, `Module`, `Verb` (Görev 5); `db` (Görev 1); `user_permissions` (Görev 4).
**Produces:**
- `type ActionResult<T> = { ok: true; data: T } | { ok: false; code: "unauthenticated"|"forbidden"|"invalid"|"conflict"|"not_found"|"error"; message: string; fieldErrors?: Record<string,string[]> }`
- `class DomainError extends Error { constructor(code: "conflict"|"not_found", message: string) }`
- `defineAction<S extends z.ZodType, T>(opts: { module: Module; verb: Verb; input: S; handler: (ctx: { actor: Actor; input: z.infer<S>; db: Db }) => Promise<T> }): (raw: unknown) => Promise<ActionResult<T>>`
  Sıra: oturum → kullanıcının `user_permissions` satırlarını yükle → `authorize(module, verb)` → Zod → handler. Yakalanmayan hata `code: "error"`, `message: "Beklenmeyen bir hata oluştu"` döner ve sunucuda kaydedilir; PostgreSQL `23505` → `conflict`.
- `proxy.ts`: oturum çerezi yoksa `/login?next=<yol>`'a yönlendirir; `/login`, `/api/auth/*`, `/api/health`, `/i/*` (davetiye), statik dosyalar hariç.
- `(app)/layout.tsx`: sunucu bileşeni; `requireActor()`; menüde yalnızca `can(actor, module, "view")` olan modüller.

- [ ] **Step 1: Başarısız testler:**
  - Oturumsuz çağrı → `{ ok:false, code:"unauthenticated" }`, handler çağrılmaz.
  - `controller` rolü `module:"events", verb:"create"` action'ını çağırır → `forbidden`, handler çağrılmaz.
  - Geçersiz girdi (`id: "abc"` için `z.uuid()`) → `invalid` + `fieldErrors.id`; yanıtta veritabanı metni yoktur.
  - Handler `new Error('relation "x" does not exist')` atar → `code:"error"`, `message` tam olarak `"Beklenmeyen bir hata oluştu"`.
  - Handler içinde `23505` → `conflict`.
  - `tests/lint/actions-use-define-action.test.ts`: `src/features/**/actions.ts` ve `src/features/**/actions/*.ts` dosyalarındaki her dışa aktarım `defineAction(` çağrısının sonucudur (kaynak metni taranır); ihlal eden dosya adı hata mesajında yer alır.
- [ ] **Step 2:** FAIL. **Step 3:** Uygula; shadcn bileşenlerini olduğu gibi kopyala, yalnızca içe aktarma yollarını düzelt. **Step 4:** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.

### Görev 7: CI ve konteyner (Haiku)

**Files:** Create: `web/Dockerfile`, `web/.dockerignore`, `.github/workflows/web-ci.yml`, `web/src/app/api/health/route.ts`; Modify: `.github/workflows/build-and-push.yml` (yalnızca `web-ci` başarılıysa imaj üretir)

- [ ] **Step 1:** `web-ci.yml`: `pull_request` ve `push` (`web/**`); `postgres:17-alpine` servis konteyneri (`POSTGRES_HOST_AUTH_METHOD=trust`, port `54329:5432`); adımlar sırayla `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- [ ] **Step 2:** `Dockerfile`: çok aşamalı, `node:24-alpine`, standalone çıktı, root olmayan kullanıcı, `HEALTHCHECK` → `/api/health`. `/api/health` yalnızca `{ "status": "ok" }` döner (veritabanına `select 1` atar; başarısızsa 503, ayrıntı yok).
- [ ] **Step 3:** Doğrula: `npm run build` başarılı; `node -e "require('yaml')"` gerekmeden `npx --yes js-yaml .github/workflows/web-ci.yml` ayrıştırma hatası vermez.

---

## Sonraki aşamalar (her biri başlamadan önce bu dosyaya görev düzeyinde eklenir)

| Aşama | Görevler | Model |
|---|---|---|
| 2 | Etkinlik + masa yerleşimi (tuval), müşteri, personel + katalog, ekip + masa grubu + atama, davetiye, ayarlar + kullanıcı yönetimi | Sonnet (paralel), tuval ve atama Opus |
| 3 | Rezervasyon servisi, check-in (koşullu UPDATE, idempotency), QR belirteci, istatistikler | Opus |
| 4 | SSE + LISTEN/NOTIFY, çevrimdışı kuyruk + PWA, Excel içe aktarma, değerlendirme, bildirim, dosya yükleme | Sonnet; SSE Opus |
| 5 | Taşıma betiği (eski şema → yeni), yetim raporu, Playwright uçtan uca, eski `backend/` ve `frontend/` kaldırma | Opus + Sonnet |

## Ana oturumun yapamayacağı, kullanıcıya kalan işler

- Gmail SMTP uygulama parolasının iptali.
- Aşama 0 düzeltmelerinin canlıya dağıtımı ve canlı veri taşımasının çalıştırılması.
- Git geçmişinin yeniden yazılması (istenirse).
