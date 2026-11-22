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

### Task 0A: Depo temizliği (Haiku)

**Files:**
- Modify: `.gitignore`
- Create: `docs/legacy/schema.sql`
- Delete (yalnızca git index'inden, `git rm --cached`; dosyalar diskte kalır): `personnel_images_correct/`, `exc/`, `backend/uploads/`, `backend/seed-data.sql`, `.claude/settings.local.json`, kökteki `More Actions*.md`, `Ekran görüntüsü*.png`, `image.png`
- Delete (tamamen): `AD.JSON`, `backend/package.json.lnk`, `backend/src/modules/staff/staff.service.ts.bak`, `docker-compose.coolify.yml` (`.yaml` kalır), `frontend/Untitled 3.png`

- [ ] **Step 1:** `backend/seed-data.sql` içinden yalnızca şema ifadelerini (`CREATE`, `ALTER`, `COMMENT`, `SET`; `INSERT` ve `COPY` verisi hariç) `docs/legacy/schema.sql` dosyasına çıkar. Doğrula: `grep -c "^CREATE TABLE" docs/legacy/schema.sql` → `33`; `grep -ci "insert into\|@gmail" docs/legacy/schema.sql` → `0`.
- [ ] **Step 2:** `.gitignore`'a ekle: `personnel_images_correct/`, `exc/`, `*.xlsx`, `*.bak`, `*.lnk`, `*.code-workspace`, `backend/uploads/`, `backend/seed-data.sql` (mevcut `!backend/seed-data.sql` istisnasını kaldır), `web/.pgdata/`, `web/.env*` (`!web/.env.example`), `web/uploads/`.
- [ ] **Step 3:** Yukarıdaki silme işlemlerini uygula. Doğrula: `git ls-files | grep -c "personnel_images_correct\|\.xlsx$\|seed-data"` → `0`; `ls backend/seed-data.sql personnel_images_correct | head -2` dosyaların diskte durduğunu gösterir.

### Task 0B: Eski backend güvenlik düzeltmeleri (Sonnet)

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

### Task 1: İskelet, yerel veritabanı, test altyapısı (Sonnet)

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

### Task 2: Durum makineleri (Haiku)

**Files:** Create: `web/src/domain/event-status.ts`, `web/src/domain/reservation-status.ts`, `web/tests/domain/event-status.test.ts`, `web/tests/domain/reservation-status.test.ts`

**Interfaces — Produces:**
- `EVENT_STATUSES = ["draft","published","active","completed","cancelled"] as const`; `canTransitionEvent(from, to): boolean`.
  İzinli geçişler: `draft→published|cancelled`, `published→draft|active|cancelled`, `active→completed|cancelled`. `completed` ve `cancelled` sondur.
- `RESERVATION_STATUSES = ["pending","confirmed","checked_in","cancelled","no_show"] as const`; `ACTIVE_RESERVATION_STATUSES = ["pending","confirmed","checked_in"] as const`; `canTransitionReservation(from, to): boolean`.
  İzinli geçişler: `pending→confirmed|cancelled|no_show|checked_in`, `confirmed→checked_in|cancelled|no_show`, `no_show→checked_in`, `cancelled→confirmed`. `checked_in` sondur.

- [ ] **Step 1:** Tablo güdümlü testler: her iki makine için 5×5 = 25 çiftin tamamı beklenen sonuçla; ayrıca `canTransitionEvent("completed","draft") === false`, `canTransitionReservation("no_show","checked_in") === true`, `canTransitionReservation("checked_in","cancelled") === false`, aynı duruma geçiş her zaman `false`.
- [ ] **Step 2:** `npx vitest run tests/domain` → FAIL. **Step 3:** Uygula. **Step 4:** → PASS.

### Task 3: Kimlik doğrulama (Opus)

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

### Task 4: Alan şeması (Opus)

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

### Task 5: Yetki politikası (Sonnet)

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

### Task 6: `defineAction`, rota koruması, uygulama kabuğu (Sonnet)

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

### Task 7: CI ve konteyner (Haiku)

**Files:** Create: `web/Dockerfile`, `web/.dockerignore`, `.github/workflows/web-ci.yml`, `web/src/app/api/health/route.ts`; Modify: `.github/workflows/build-and-push.yml` (yalnızca `web-ci` başarılıysa imaj üretir)

- [ ] **Step 1:** `web-ci.yml`: `pull_request` ve `push` (`web/**`); `postgres:17-alpine` servis konteyneri (`POSTGRES_HOST_AUTH_METHOD=trust`, port `54329:5432`); adımlar sırayla `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- [ ] **Step 2:** `Dockerfile`: çok aşamalı, `node:24-alpine`, standalone çıktı, root olmayan kullanıcı, `HEALTHCHECK` → `/api/health`. `/api/health` yalnızca `{ "status": "ok" }` döner (veritabanına `select 1` atar; başarısızsa 503, ayrıntı yok).
- [ ] **Step 3:** Doğrula: `npm run build` başarılı; `node -e "require('yaml')"` gerekmeden `npx --yes js-yaml .github/workflows/web-ci.yml` ayrıştırma hatası vermez.

---

## Aşama 2–5 ortak kuralları

- **Katmanlar (her alan `web/src/features/<alan>/`):** `schemas.ts` (Zod girdi şemaları), `service.ts` (iş mantığı; imza `(db: Db | Tx, actor: Actor, input) => Promise<…>`; Next'e bağımlı değildir, testler bunu çağırır), `queries.ts` (okuma; Sunucu Bileşenleri çağırır, ilk satırda `authorize`), `actions.ts` (yalnızca `defineAction` ile `service` sarmalayıcıları), `components/` (istemci bileşenleri). Sayfalar `web/src/app/(app)/<rota>/`.
- **Hatalar:** iş kuralı ihlali `DomainError("conflict" | "not_found", "<Türkçe mesaj>")`; yetki `authorize(...)`. Servis, veritabanı hata kodunu (`23505`, `23503`) yakalayıp anlamlı `DomainError`'a çevirir.
- **Transaction:** birden fazla satır yazan her servis işlevi `db.transaction` içinde çalışır.
- **Testler:** `web/tests/features/<alan>/*.test.ts`, gerçek veritabanı, `tests/helpers/factories.ts` ile veri. Her ajan kendi test veritabanını kullanır: `TEST_DB_NAME=eventflow_test_<alan> npx vitest run tests/features/<alan>`. Ajanlar `npm run build` çalıştırmaz.
- **Davranış kaynağı:** eski kod (`backend/src/modules/<alan>`, `frontend/src/app/...`). Eski davranış ile bu plan/spec çelişirse spec geçerlidir; çelişki raporda belirtilir.
- **Arayüz:** `web/src/components/ui` bileşenleri; her rota için `loading.tsx` ve boş durum; formlar action sonucundaki `fieldErrors`'ı alan altında gösterir. Dosya başına en çok 400 satır.

## Aşama 2 — Alan modülleri (paralel)

### Task 8: Etkinlikler (Sonnet)

`features/events`; rotalar `/events`, `/events/new`, `/events/[id]`. Servis: `createEvent`, `updateEvent`, `changeEventStatus` (`canTransitionEvent`; geçersiz geçiş `conflict`), `deleteEvent` (yalnızca `draft` ve rezervasyonsuz), `listEvents`, `getEvent`. `starts_at` oluşturmada geçmişte olamaz.

**Üretir:** `getEventOrThrow(db, id)`, `listEventTables(db, eventId)`, `totalCapacity(db, eventId)`.

Testler: geçiş matrisi servis üzerinden; `completed → draft` reddi; rezervasyonu olan etkinlik silinemez; bitiş ≤ başlangıç `invalid`; `staff` rolü oluşturamaz.

### Task 9: Mekân ve masa yerleşimi (Opus)

`features/venue`; rotalar `/events/[id]/venue`, `/venues` (şablonlar), `/settings/table-types`. Servis: `saveLayout(db, actor, { eventId, tables: TableInput[], decor })` — tek transaction'da ekle/güncelle/sil; rezervasyonu veya ataması olan masa silinmek istenirse tümü geri alınır ve `conflict` mesajı masa etiketlerini listeler; etiket etkinlik içinde tekil; `applyVenueTemplate`, `saveAsTemplate`. Tuval: eski `EventCanvas`/`useVenueState` davranışı Konva ile, tek durum kaynağı (Zustand store), geri al/yinele; 3B önizleme `next/dynamic` ile tembel yüklenir ve eski bileşenden parçalanarak taşınır.

Testler: 200 masalık yerleşim kaydı atomik; rezervasyonlu masa silme reddi ve hiçbir değişikliğin yazılmaması; yinelenen etiket reddi; kapasite 0 reddi; şablon uygulama mevcut rezervasyonlu masaları korur.

### Task 10: Müşteriler (Sonnet)

`features/customers`; rotalar `/customers`, `/customers/[id]`, `/guests`. Servis: `createCustomer`, `updateCustomer`, `searchCustomers` (ad/telefon, sayfalı), `setBlacklist`, etiket ve not işlemleri. `normalizePhone(raw): string | null` (Türkiye: `+90XXXXXXXXXX`), `normalizeEmail`.

**Üretir:** `findOrCreateCustomer(tx, { customerId?, phone?, email?, fullName? }): Promise<{ id: string; isBlacklisted: boolean }>` — sıra: id → telefon → e-posta → ad varsa yeni; eşzamanlı çağrıda mükerrer oluşturmaz (`ON CONFLICT`).

Testler: aynı telefonla 10 eşzamanlı `findOrCreateCustomer` → tek satır; `0532 111 22 33`, `+905321112233`, `5321112233` aynı müşteri; adaş ama farklı telefonlu iki müşteri birleşmez.

### Task 11: Personel ve kataloglar (Sonnet)

`features/staff`; rotalar `/staff`, `/staff/[id]`, `/settings/organization` (departman, pozisyon, görev yeri, vardiya şablonları, personel rolleri/renkleri). Servis: personel CRUD, `sicil_no` tekil, pasifleştirme (ataması olan personel silinemez), katalog CRUD.

**Üretir:** `listActiveStaff(db, filter)`.

Testler: yinelenen sicil `conflict`; ataması olan personel silme reddi; pasif personel `listActiveStaff`'ta yok.

### Task 12: Ekip, masa grubu ve atama (Opus)

`features/staffing`; rota `/events/[id]/team-organization`. Servis: `saveTeams` (ekip kimlikleri korunur: güncelle/ekle/sil farkı), `saveTableGroups` (bir masa tek grupta; taşıma atomik), `assignTeamToGroup`, `saveAssignments` (masa + özel görev + servis noktası atamaları tek transaction; özel görevler kaybolmaz), `autoAssign(strategy: "balanced" | "zone" | "random")` (localar hariç), `saveExtraStaff`, `applyOrganizationTemplate` (atomik; personel `staff.id` ile eşlenir, ad ile değil; hedef etkinlikte olmayan masa kimlikleri raporlanır). Arayüz: eski sihirbazın adımları, her adım ayrı bileşen.

Testler: spec §13 madde 10 ve 11; toplu kayıt ortasında hata → hiçbir değişiklik yok; ekip güncellemede `table_groups.team_id` bağları korunur; aynı personel aynı vardiyaya iki kez atanamaz (`conflict`).

### Task 13: Ayarlar, kullanıcı yönetimi, dosya yükleme (Sonnet)

`features/settings`, `features/users`, `features/uploads`; rotalar `/admin/users`, `/admin/settings`, `/api/uploads/[...path]`. Kullanıcı: oluştur (Better Auth iç bağdaştırıcısı), rol/izin düzenle, `deactivateUser`/`reactivateUser`, parola sıfırla (yalnızca admin). Ayarlar: sistem ayarları; SMTP parolası AES-256-GCM ile şifreli (`SETTINGS_ENCRYPTION_KEY`), hiçbir sorgu/yanıtta düz metin dönmez.

**Üretir:** `saveImage(file: File, kind: "avatar"|"event"|"invitation"|"logo"): Promise<{ path: string }>` (dosya imzası denetimi, `sharp` ile WebP'ye yeniden kodlama, rastgele ad, ≤5 MB), `deleteImage(path)`, yetki denetimli sunum handler'ı.

Testler: PNG uzantılı HTML dosyası reddedilir; `../` içeren yol 404; SMTP parolası `getSettings` çıktısında yok; admin olmayan kullanıcı oluşturamaz; son admin pasifleştirilemez.

### Task 14: Davetiyeler (Sonnet)

`features/invitations`; rotalar `/events/[id]/invitation`, `/templates`, herkese açık `/i/[token]`. Şablon CRUD, etkinlik davetiyesi, editör (eski `InvitationEditor` parçalanarak), e-posta gönderimi (nodemailer), WhatsApp bağlantısı. Herkese açık sayfa yalnızca imzalı belirteçle erişilir ve yalnızca davetiye için gereken alanları döndürür.

Testler: geçersiz/başka etkinliğe ait belirteç 404; herkese açık yanıtta telefon/e-posta yok; SMTP yapılandırılmamışsa anlaşılır hata.

## Aşama 3 — Rezervasyon ve check-in (Opus, sıralı)

### Task 15: Rezervasyon servisi

`features/reservations`; rotalar `/reservations`, `/reservations/[eventId]`, `/reservations/[eventId]/new`. Servis: `createReservation` (müşteri `findOrCreateCustomer`; kara listede ise `conflict`, `actor.role === "admin"` ve `overrideBlacklist: true` ile aşılır; kapasite aşımı `conflict`; durum `confirmed`; `23505` → "Bu masa için aktif bir rezervasyon var"), `updateReservation` (masa değişimi aynı kurallar), `changeReservationStatus` (`canTransitionReservation`), `cancelReservation`, `markNoShows(eventId)` (yalnızca `completed` etkinlik; müşteri sayaçları güncellenir), `availableTables(eventId)`. QR: `signQrToken(reservationId): string`, `verifyQrToken(token): { reservationId } | null` (HMAC-SHA256, `QR_SIGNING_KEY`; masa bilgisi taşımaz).

Testler: spec §13 madde 1, 4, 5, 6, 7, 9, 15 — eşzamanlılık testleri ayrı havuz bağlantılarıyla.

### Task 16: Check-in

`features/check-in`; rotalar `/check-in`, `/check-in/[eventId]`, `POST /api/check-in` (çevrimdışı kuyruk için). Servis: `checkIn({ token | legacyHash | reservationId, idempotencyKey, clientTimestamp })` — tek koşullu `UPDATE … WHERE status IN ('pending','confirmed','no_show') RETURNING`; aynı `idempotencyKey` tekrarında aynı sonucu döner; zaten yapılmışsa `{ outcome: "already_checked_in" }`; iptal edilmişse `conflict`; müşteri `total_attended_events` aynı transaction'da +1; `registerWalkIn`, `updateGuestCount` (kapasite aşımı reddedilir), `eventStats(eventId)` (beklenen = pending + confirmed + checked_in; kalan = pending + confirmed). Eski 3 özellik testi taşınır.

Testler: spec §13 madde 2, 3, 8 (QR kısmı); aynı QR ile 10 eşzamanlı check-in → tek başarı, sayaç +1; eski `legacy_qr_hash` ile check-in.

## Aşama 4 — Tamamlayıcılar

### Task 17: Canlı güncelleme (Opus)

`features/realtime`; `GET /api/events/[eventId]/stream` (SSE). Tek paylaşımlı `LISTEN` bağlantısı; `publish(tx, channel, payload)` `pg_notify` çağırır (commit ile birlikte yayılır); istemci kancası `useEventStream(eventId)` TanStack Query önbelleğini geçersiz kılar. Yetki: akışa bağlanmak `check_in:view` veya `reservations:view` ister. Olaylar: `reservation.changed`, `guest.checked_in`, `table.updated`, `stats.updated`, `notification.created`.

Testler: geri alınan transaction olay yaymaz; yetkisiz bağlantı 403; bağlantı kopunca dinleyici temizlenir.

### Task 18: Çevrimdışı check-in ve PWA (Sonnet)

Tek IndexedDB şeması, tek kuyruk; kuyruk `POST /api/check-in`'e `idempotencyKey` ile gönderir; service worker kimlik doğrulamalı API yanıtlarını önbelleğe almaz; QR okuyucu eski `qr-scanner.tsx`'ten taşınır.

Testler: kuyruk tekrar gönderimde mükerrer check-in üretmez (kuyruk mantığı saf işlev olarak test edilir).

### Task 19: Excel içe aktarma (Sonnet)

`features/import`; rezervasyon ve personel/atama içe aktarma; `exceljs`; ayrıştırma sunucuda; önizleme → onay; satırlar `createReservation` / `saveAssignments`'tan geçer; satır bazlı hata raporu; müşteri adla değil telefon/e-posta ile eşlenir.

Testler: spec §13 madde 8; dolu masaya satır reddi; kapasite aşımı reddi; 10 MB üstü dosya reddi.

### Task 20: Değerlendirmeler ve bildirimler (Sonnet)

`features/reviews` (`/leader/*`): puan = Σ(puan/5 × ağırlık)/Σağırlık × 100, ağırlıklar 15/15/15/20/10/10/5/10; eşikler ≥90, ≥80, ≥60, ≥40, ≥20; `review_enabled` kapalıyken yazılamaz; tamamlanan kilitlenir; lider yalnızca kendi ekibi. `features/notifications`: oluştur, okundu, hedef rol.

Testler: spec §13 madde 12, 13.

## Aşama 5 — Taşıma ve kapanış

### Task 21: Veri taşıma betiği (Opus)

`web/scripts/migrate-legacy/`: `LEGACY_DATABASE_URL`'den salt-okunur okur, yeni şemaya yazar; `--dry-run`; `LEGACY_TZ` (varsayılan `Europe/Istanbul`); eşleme `task-4-report.md` tablosundan; rapor: yetim masa referansları, eşleşmeyen personel, çakışan rezervasyonlar, yalnızca harf büyüklüğüyle ayrışan kullanıcı adları, organizatörsüz etkinlikler. Yerel doğrulama: `docs/legacy/schema.sql` özel kümeye yüklenir, sentetik veriyle test edilir.

### Task 22: Uçtan uca testler ve kapanış (Sonnet)

Playwright: giriş, etkinlik + yerleşim, rezervasyon, QR check-in. `README.md`, `DEPLOYMENT.md` güncellenir; `docker-compose` `web` servisine geçer. Eski `backend/` ve `frontend/` kaldırılması **kullanıcı onayı gerektirir** (canlı geçişten sonra).

## Ana oturumun yapamayacağı, kullanıcıya kalan işler

- Gmail SMTP uygulama parolasının iptali.
- Aşama 0 düzeltmelerinin canlıya dağıtımı ve canlı veri taşımasının çalıştırılması.
- Git geçmişinin yeniden yazılması (istenirse).
