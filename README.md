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
ADMIN_PASSWORD='en-az-12-karakterli-parola' node --env-file=.env.local scripts/create-admin.mjs admin

# 5) Geliştirme sunucusu: http://localhost:3000
npm run dev
```

### İlk yönetici nasıl oluşturulur

Uygulamada kayıt ekranı ve tohum (seed) verisi **yoktur**; ilk yönetici `web/scripts/create-admin.mjs` ile açılır.
Betik düz Node'dur (`tsx`/TypeScript gerekmez), bu yüzden **üretim imajında da çalışır** (`/opt/migrator/create-admin.mjs`):

```
ADMIN_PASSWORD=... node --env-file=.env.local scripts/create-admin.mjs <kullanıcı-adı> [--email <e-posta>] [--name <ad>]
printf %s "$PAROLA" | node --env-file=.env.local scripts/create-admin.mjs --password-stdin <kullanıcı-adı>
... --reset     # var olan YÖNETİCİNİN parolasını sıfırlar, hesabı etkinleştirir, oturumlarını siler
```

- Parola yalnızca `ADMIN_PASSWORD` ortam değişkeninden ya da `--password-stdin` ile standart girdiden okunur (komut
  satırı geçmişine düşmesin diye argüman değildir; hiçbir çıktıya yazılmaz); en az 12 karakter olmalıdır.
- Etkin bir yönetici zaten varsa **hiçbir şey yapmadan** çıkış kodu 2 ile biter; `--reset` yalnızca var olan bir
  yönetici hesabında çalışır (yönetici olmayan kullanıcıyı yükseltmez, kod 4). Diğer kodlar: 1 kullanım/doğrulama,
  3 kullanıcı adı ya da e-posta çakışması, 5 veritabanı hatası.
- E-posta verilmezse `<kullanıcı-adı>@eventflow.invalid` yer tutucusu kullanılır.
- Kullanıcı adı 1-100 karakter olmalı, büyük/küçük harf duyarlıdır, başında/sonunda boşluk ve kontrol karakteri içermemelidir.
- Rol `admin`, hesap etkin ve e-posta doğrulanmış olarak oluşur; diğer kullanıcıları yönetici arayüzünden
  (`/admin/users`) ekleyin.
- Docker'da: `docker compose run --rm create-admin ...` (bkz. [`DEPLOYMENT.md`](DEPLOYMENT.md) "İlk yönetici").
  `scripts/create-admin-dev.ts` testlerin kullandığı geliştirme yardımcısıdır (aynı kurallar, Better Auth bağlamı üzerinden).

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
| `node scripts/create-admin.mjs` | İlk yönetici / parola sıfırlama (yukarıya bakın) |
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
web/drizzle/      SQL migration'ları (git'te tutulur; yazar kuralları için `web/drizzle/README.md`)
web/scripts/      create-admin.mjs (ilk yönetici; üretim imajında da var), migrate.mjs (üretim migrator'ı), pg (yerel küme),
                  migrate-legacy/, create-admin-dev.ts (test yardımcısı)
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

## Eski uygulamadan taşınmayanlar ve bilinen sınırlar

Bu liste ilerleme notlarının (`.superpowers/sdd/.../progress.md`) ve düzeltme dalgası raporlarının son durumuna göre
tutulur. Canlıya almadan önce gerçek kullanımla karşılaştırın.

**Eski uygulamada olup taşınmayan / eksik kalan**
- Personel CSV içe aktarma, personel istatistikleri, departman-pozisyon ilişkileri, personel için giriş hesabı.
- Yerleşim düzenleyicide çoklu seçim, geri al/yinele, PNG/PDF dışa aktarma; masa boyutu kalıcı değil
  (kapasite/türden türetilir); 3B önizleme eskisinin portu değil, basit yeni bir bileşendir.
- Rezervasyon silme, ödeme ve bilet e-postası; e-posta gönderim geçmişi ve gönderim hız sınırı yok; davet belirteçleri
  süresizdir (herkese açık davet sayfası ve görseli ise IP başına sınırlıdır, aşağıya bakın).
- Lider analitik sayfaları; okunmamış bildirim rozeti; `staff` rolünün bildirimlere erişimi yok.
- Etkinlik şemasında konum metni alanı yok; davet şablonundaki `{{eventLocation}}` boş çıkar.
- Eski veritabanındaki bazı alanların yeni şemada karşılığı yoktur; kayıp listesi veri taşıma raporunun "Şema
  boşlukları" bölümünde çıkar (`task-21-report.md`).

**Tasarım gereği sınırlar**
- Gerçek zamanlı akış (SSE) tek süreçlidir, yeniden oynatma yoktur, yetki yalnızca bağlanırken denetlenir: web
  servisini tek kopya çalıştırın.
- Herkese açık davet uçları (`/i/[token]`, görsel) IP başına dakikada 120 istekle sınırlıdır; sayaç PostgreSQL'dedir
  (`public_rate_limits`), kopyalar arasında paylaşılır. Veritabanı hatasında fail-open'dır (hata günlüğe yazılır).
  `TRUSTED_IP_HEADER` tanımsızsa tüm istemciler tek kovaya düşer (üretimde zorunludur).
- Güvenlik başlıkları (nosniff, X-Frame-Options, HSTS, Referrer/Permissions-Policy) ve istek başına nonce'lu tam bir
  İçerik Güvenlik Politikası (CSP) vardır (`web/src/proxy.ts`, `web/src/lib/csp.ts`): `script-src 'self' 'nonce-…'
  'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self'` vb.; üretimde `unsafe-eval` yok.
  Bilinen gevşetmeler: React `style=` öznitelikleri için `style-src-attr 'unsafe-inline'` (betik çalıştırmaz);
  yalnızca geliştirmede `unsafe-eval` ve nonce'suz `style-src 'unsafe-inline'`. Nonce nedeniyle sayfalar istek başına
  dinamik üretilir (statik önbellek yok). e2e koşuları tarayıcı konsolunda CSP ihlali çıkarsa başarısız olur.
- Çevrimdışı check-in kuyruğu (yürüyerek gelen misafir kaydı dahil) kullanıcıya aittir; çıkışta servis çalışanı kabuğu
  silinir. Çevrimdışıyken çıkış yapılırsa sunucu oturumu kapanamaz: cihaz "çıkış bekliyor" diye kilitlenir ve bağlantı
  gelince çıkış otomatik tamamlanır. Çevrimdışı akış (servis çalışanı, IndexedDB kuyruğu, kamera/QR, kaybolan yanıtta
  idempotent yeniden deneme) başsız Chromium'da, üretim derlemesine karşı gerçek tarayıcıyla denendi
  (`web/e2e/offline-*.spec.ts`). **Doğrulanmadı**: fiziksel cihaz kamerası, yerel `BarcodeDetector`, iki sekmeli Web
  Locks davranışı, PWA kurulumu. Çevrimdışı walk-in için sayfa önce bir kez çevrimiçi yüklenmiş olmalıdır.
- `npm audit`: 6 "moderate" bulgu açıktır; uyumlu bir sürüm yok (`drizzle-kit` → eski `esbuild`: yalnızca geliştirme aracı,
  imajda yoktur; `exceljs` → `uuid`: zayıf kod yolu (v3/v5/v6 + `buf`) `exceljs` tarafından çağrılmaz). Gerekçe `fixwave-H-report.md`'de.
- Eski veri taşıma politikası kararları (olay sahibi olmayan etkinlikler, müşterisiz rezervasyonlar, benzersizlik
  çakışmaları) `task-21-report.md` içindedir; gerçek çalıştırmadan önce okuyun.

**Önceki sürümlerde listelenip şimdi giderilenler**: `venue_owner` kendi şablonunu düzenleyebilir; `reviews` izin modülü
veritabanı enum'unda var (migration 0005); yetkisiz sayfa için 403 sayfası var; eski QR belirteçleri check-in'de kabul
edilir; davet sayfası IP başına sınırlı; ilk yönetici üretim imajından oluşturulabilir.

## Hiç çalıştırılmayanlar (dürüst liste)

Aşağıdakiler yazıldı ya da okunarak gözden geçirildi, **ama gerçekten çalıştırılıp denenmedi**:
- **Docker imajı derlemesi** (`web/Dockerfile`) ve imajın içinde `migrate.mjs` / `create-admin.mjs` — Docker bu geliştirme
  makinesinde kurulu değil. Betikler ve bağımlılık kapanışı imaj dışında, aynı `package-lock.json` kapanışıyla ayrı bir
  dizinde denendi.
- **Compose başlatma sırası** (`postgres` → `migrate` → `web`, `create-admin` profili), `/data/uploads` volume sahipliği,
  Coolify/Traefik davranışı (ve Coolify'ın `profiles` desteği).
- **GitHub Actions'ta CI** (`web-ci.yml` ve `build-and-push.yml` içindeki `workflow_call`) bir kez bile çalışmadı.
- **Gerçek veri taşıma**: ETL betiği yalnızca sentetik veriyle test edildi; gerçek eski veritabanıyla hiç çalıştırılmadı.
- **Cihaz kamerası**: QR okuyucu yalnızca sahte video akışıyla (headless Chromium, html5-qrcode yedek yolu) denendi; gerçek telefon/tablet kamerasıyla ve yerel `BarcodeDetector` ile denenmedi.
- Arayüz, geliştirme sırasında tarayıcıda yalnızca kısmen elle denendi; canlıya almadan önce elle duman testi yapın.
