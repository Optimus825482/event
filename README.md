# EventFlow PRO

Etkinlik, mekan yerleşimi, rezervasyon ve kapı (check-in) yönetim sistemi.

Bu depo **yeniden yazılmış uygulamayı** `web/` altında barındırır (Next.js 16 + Drizzle + PostgreSQL 17 + Better Auth).
Eski NestJS (`backend/`) ve Next.js (`frontend/`) uygulamaları, canlı geçiş tamamlanıp sahibi onaylayana kadar
**geri dönüş için** depoda durur; yeni geliştirme yalnızca `web/` içindedir.

| Konu | Nerede |
| --- | --- |
| Uygulama | `web/` |
| Üretim kurulumu, geçiş, geri alma | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Eski veriyi yeni şemaya taşıma | [`web/scripts/migrate-legacy/README.md`](web/scripts/migrate-legacy/README.md) |
| Eski yığın (yalnızca geri dönüş) | `docker-compose.legacy.yml`, `docker-compose.legacy.coolify.yaml` |
| Yeniden kurulum tasarımı ve görev raporları | `.superpowers/sdd/2026-11-22-eventflow-yeniden-kurulum/` |

## Teknolojiler

Next.js 16 (App Router, `output: "standalone"`), React 19, TypeScript, Tailwind 4, Drizzle ORM, PostgreSQL 17,
Better Auth (kullanıcı adı + parola), TanStack Query, Zod, Vitest. Nesne depolama yoktur: yüklemeler diskte
(`UPLOAD_DIR`) tutulur.

## Yerel kurulum

Gereksinimler: Node.js 24 ve PostgreSQL 17 ikilileri. Veritabanı sistem servisi olarak değil, **projeye özel küme**
olarak çalışır (`localhost:54329`); sistemdeki 5432/5433 gibi mevcut kurulumlara dokunulmaz.

```bash
cd web
npm ci

# 1) Özel PostgreSQL kümesi (localhost:54329, kullanıcı postgres, trust kimlik doğrulama).
#    Veri dizini web/.pgdata; eventflow_dev ve eventflow_test veritabanlarını oluşturur.
npm run db:start

# 2) Ortam dosyası
cp .env.example .env.local
#    BETTER_AUTH_SECRET: en az 32 karakter, ör. `openssl rand -base64 48`
#    Geliştirmede TRUSTED_IP_HEADER, SETTINGS_ENCRYPTION_KEY ve QR_SIGNING_KEY boş kalabilir.

# 3) Şemayı uygula
npm run db:migrate

# 4) İlk yönetici (aşağıya bakın)
ADMIN_PASSWORD='en-az-12-karakterli-parola' npx tsx --env-file=.env.local scripts/create-admin.ts admin

# 5) Geliştirme sunucusu: http://localhost:3000
npm run dev
```

### İlk yönetici nasıl oluşturulur

Uygulamada kayıt ekranı ve tohum (seed) verisi **yoktur**; ilk yönetici `web/scripts/create-admin.ts` ile açılır:

```
ADMIN_PASSWORD=... npx tsx --env-file=.env.local scripts/create-admin.ts <kullanıcı-adı> [e-posta]
```

- Parola yalnızca `ADMIN_PASSWORD` ortam değişkeninden okunur (komut satırı geçmişine düşmesin diye argüman değildir);
  en az 12 karakter olmalıdır.
- E-posta verilmezse `<kullanıcı-adı>@eventflow.invalid` yer tutucusu kullanılır.
- Kullanıcı adı 1-100 karakter olmalı, başında/sonunda boşluk ve kontrol karakteri içermemelidir.
- Rol `admin`, hesap etkin ve e-posta doğrulanmış olarak oluşur; diğer kullanıcıları yönetici arayüzünden
  (`/admin/users`) ekleyin.
- Betik TypeScript kaynaklarını (`tsx`) kullanır; **üretim imajında yoktur**. Üretimde ilk yönetici için bkz.
  [`DEPLOYMENT.md`](DEPLOYMENT.md) ("İlk yönetici").

## Komutlar (`web/` içinde)

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` / `build` / `start` | Geliştirme sunucusu / üretim derlemesi / derlemeyi başlat |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest (özel kümede gerçek PostgreSQL veritabanlarıyla; önce `db:start`) |
| `npm run db:start` / `db:stop` | Özel PostgreSQL kümesini başlat / durdur |
| `npm run db:reset` | **Yerel veritabanlarını siler** ve yeniden oluşturur (yalnızca geliştirme) |
| `npm run db:generate` | Şema değişikliğinden yeni Drizzle migration'ı üretir (`web/drizzle/`) |
| `npm run db:migrate` | Migration'ları `drizzle-kit` ile uygular (geliştirme) |
| `npm run db:migrate:runtime` | Üretimdekiyle aynı migrator (`scripts/migrate.mjs`; advisory lock'lu, `drizzle-kit`siz) |
| `npm run db:migrate-legacy` | Eski veritabanından tek seferlik veri taşıma ([kılavuz](web/scripts/migrate-legacy/README.md)) |

## Mimari özeti

```
web/src/
  app/            Next.js yolları: (app)/ giriş gerektiren sayfalar; api/ (auth, check-in, events/[eventId]/stream,
                  health, uploads); i/[token] herkese açık davet sayfası; login/
  features/       Özellik klasörleri; her biri kendi service/actions/queries/schemas/components dosyalarını taşır:
                  auth, events, venue, reservations, customers, staff, staffing, invitations, check-in, import,
                  notifications, reviews, realtime, settings, uploads, users
  db/             Drizzle şeması (db/schema/*) ve havuz (db/client.ts)
  domain/         Saf iş kuralları (etkinlik / rezervasyon durum makineleri)
  lib/action.ts   defineAction
  proxy.ts        Oturum çerezi yoksa /login'e yönlendirir; /api/* için 401
  env.ts          Ortam değişkeni doğrulaması (Zod)
web/drizzle/      SQL migration'ları (git'te tutulur)
web/scripts/      create-admin, pg (yerel küme), migrate.mjs (üretim migrator'ı), migrate-legacy/
```

- **`defineAction`** (`src/lib/action.ts`): her sunucu eylemi `module` + `verb` + Zod `input` + `handler` ile tanımlanır.
  Sıra: oturum, izin satırları, `authorize(module, verb)` (isteğe bağlı sahiplik `resource`), girdi doğrulaması,
  handler. Sonuç `{ ok, data }` ya da `{ ok: false, code, message, fieldErrors }`; iş kuralı hataları `DomainError`,
  PostgreSQL benzersizlik/yabancı anahtar ihlalleri `conflict` olarak döner. Roller: `admin`, `organizer`, `staff`,
  `leader`, `controller`, `venue_owner`; temel izinler `features/auth/policy.ts` içindedir, kullanıcı başına satırlarla
  genişletilir.
- **Gerçek zamanlı (SSE)**: `GET /api/events/[eventId]/stream` etkinlik başına Server-Sent Events akışıdır; hub ve
  PostgreSQL dinleyicisi `features/realtime/` altındadır. Kullanıcı başına 5 bağlantı sınırı vardır, yetki yalnızca
  bağlanırken denetlenir, yeniden oynatma (replay) yoktur ve hub **tek süreçlidir**: web servisini tek kopya
  çalıştırın. Ters vekilde yanıt tamponlamayı kapatın (`X-Accel-Buffering: no` gönderilir).
- **Check-in** (`features/check-in`, `app/(app)/check-in`, `app/api/check-in`): kapıda QR okutma ya da arama ile giriş,
  tekrar okutmaya karşı idempotent sonuç saklama, yürüyerek gelen misafir kaydı, canlı sayaçlar. Rezervasyon QR
  belirteçleri `QR_SIGNING_KEY` (tanımsızsa `BETTER_AUTH_SECRET`'tan türetilen anahtar) ile HMAC imzalıdır.
- **İstemci IP'si**: yalnızca `TRUSTED_IP_HEADER` ile adı verilen, ters vekilin yazdığı başlığa güvenilir; üretimde
  zorunludur.

## Eski uygulamadan taşınmayanlar

Aşağıdakiler yeniden yazımda **taşınmadı ya da eksik kaldı** (kaynak: görev raporları ve ilerleme notlarındaki devir
maddeleri). Canlıya almadan önce gerçek kullanımla karşılaştırın:

- Personel CSV içe aktarma, personel istatistikleri, departman-pozisyon ilişkileri, personel için giriş hesabı.
- Yerleşim düzenleyicide çoklu seçim, geri al/yinele, PNG/PDF dışa aktarma; masa boyutu kalıcı değil (kapasite/türden
  türetilir); 3B önizleme eskisinin portu değil, basit yeni bir bileşendir; `venue_owner` kendi şablonunu düzenleyemez.
- Rezervasyon silme, ödeme ve bilet e-postası; e-posta gönderim geçmişi ve hız sınırı yok; davet belirteçleri süresiz.
- Lider analitik sayfaları; okunmamış bildirim rozeti; `staff` rolünün bildirimlere erişimi yok.
- Gerçek zamanlı akış tek süreçli, yeniden oynatma yok.
- Etkinliklerde konum metni alanı yoktu; davet şablonundaki `{{eventLocation}}` boş çıkabilir (ilerleme notlarına
  bakın, sonradan eklenmiş olabilir).
- Eski veritabanındaki bazı alanların yeni şemada karşılığı yoktur; kayıp listesi veri taşıma raporunun "Şema
  boşlukları" bölümünde çıkar (`task-21-report.md`).
- Arayüz, geliştirme sırasında tarayıcıda yalnızca kısmen elle denendi (yerleşim kanvası, davet düzenleyici, içe aktarma
  ve check-in ekranları dahil); canlıya almadan önce elle duman testi yapın.
