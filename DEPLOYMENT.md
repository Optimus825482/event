# EventFlow PRO - Dağıtım Rehberi (yeni uygulama: `web/`)

> Bu rehber `web/` uygulamasının Docker/Coolify ile üretime alınmasını anlatır. Eski NestJS + Next.js yığınının
> kaynak kodu depodan kaldırıldı; GHCR'deki son imajlarıyla `docker-compose.legacy.coolify.yaml` üzerinden hâlâ
> başlatılabilir (geri dönüş için). Eski imajlar artık yeniden üretilmez; eski rehber geçerli değildir.
>
> **Durum notu:** Docker bu geliştirme makinesinde kurulu değildi; `web/Dockerfile` ve compose dosyaları **derlenip
> çalıştırılarak denenmedi**. Yalnızca migrator ve create-admin betikleri özel PostgreSQL kümesinde gerçekten çalıştırıldı (bkz. en alt,
> "Doğrulama durumu"). İlk dağıtımı bir hazırlık (staging) ortamında deneyin.

## Mimari

```
Traefik/Coolify (HTTPS, x-real-ip) -> web (Next.js standalone, :3000) -> postgres (17, iç ağ, port yayınlanmaz)
                                      ^-- migrate (tek seferlik: node /opt/migrator/migrate.mjs)
                                      ^-- create-admin (isteğe bağlı tek seferlik, profil `tools`; bkz. İlk yönetici)
```

- `eventflow-db`: `postgres:17-alpine`, verisi `web_postgres_data` volume'unda. Port yayınlanmaz. Volume adı eski yığınınkinden
  bilerek farklıdır (eski PostgreSQL 15 verisi 17'ye bağlanıp hata vermesin, geri dönüşte eski veri sağlam kalsın).
- `migrate`: web ile **aynı imaj**; Drizzle migration'larını uygulayıp çıkar. `web`, `depends_on:
  migrate: condition: service_completed_successfully` ile yalnızca bu başarılıysa başlar. Migration web sürecine
  gömülü değildir.
- `web`: uygulama. Sağlık denetimi `GET /api/health` (veritabanına `select 1` atar). Yüklemeler `web_uploads_data`
  volume'unda (`UPLOAD_DIR=/data/uploads`).
- Dosyalar: `docker-compose.coolify.yaml` (üretim, Coolify; `coolify` dış ağı + Traefik'i Coolify yönetir),
  `docker-compose.yml` (Coolify dışı sunucu ya da yerel prova; web yalnızca `127.0.0.1:3000`).

## Ortam değişkenleri

Eksik zorunlu değişken, `docker compose config/up` komutunu `${VAR:?...}` ile hemen durdurur. Hiçbir gerçek değeri
depoya yazmayın; Coolify "Environment Variables" bölümünde ya da sunucuda ortam olarak verin.

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `DB_PASSWORD` | evet | PostgreSQL parolası. `DATABASE_URL` içine gömüldüğü için URL'de güvenli karakterler kullanın (ör. `openssl rand -hex 24`) |
| `DB_USERNAME` / `DB_NAME` | hayır | Varsayılan `postgres` / `eventflow` |
| `BETTER_AUTH_SECRET` | evet | En az 32 karakter (`openssl rand -base64 48`). Oturumları imzalar; **QR_SIGNING_KEY yoksa QR anahtarı bundan türer** |
| `BETTER_AUTH_URL` | evet | Herkese açık adres, `https://` ile başlamalı (örn. `https://eventflow.royalfnb.com`) |
| `TRUSTED_IP_HEADER` | evet | Ters vekilin istemci IP'sini yazdığı başlık. Traefik/Coolify arkasında `x-real-ip` |
| `SETTINGS_ENCRYPTION_KEY` | evet (bu yığında) | Ayarlardaki SMTP parolasını şifreler; 32 bayt base64: `openssl rand -base64 32`. Kaybedilirse kayıtlı SMTP parolası çözülemez, yeniden girilir |
| `QR_SIGNING_KEY` | hayır | QR belirteçleri için HMAC anahtarı (en az 32 karakter). Boşsa `BETTER_AUTH_SECRET`'tan türetilir. **Değişirse dağıtılmış QR'lar geçersiz olur** |
| `WEB_IMAGE` | hayır | Coolify dosyasında imaj adı; varsayılan `ghcr.io/optimus825482/eventflow-web:latest`. Geri alma için `:<commit-sha>` verin |

`UPLOAD_DIR` compose içinde `/data/uploads` olarak sabittir (adlandırılmış volume). Uygulama `NODE_ENV=production` iken
`BETTER_AUTH_URL` (https) ve `TRUSTED_IP_HEADER` olmadan açılmaz.

## Coolify ile kurulum

1. Proje > yeni kaynak > **Docker Compose** > depoyu bağlayın, dosya olarak `docker-compose.coolify.yaml` seçin.
2. Yukarıdaki ortam değişkenlerini tanımlayın.
3. `web` servisine alan adını `https://<alan-adı>:3000` biçiminde atayın (Coolify Traefik etiketlerini üretir; yeni
   etiket elle yazılmaz). `eventflow-db`, `migrate` ve `create-admin` için alan adı atamayın (Coolify otomatik ürettiyse silin).
4. Deploy. Sıra: postgres sağlıklı olunca `migrate` çalışır ve çıkar; ardından `web` başlar.
5. İmaj, GitHub Actions'ın `build-and-push.yml` iş akışıyla `ghcr.io/optimus825482/eventflow-web` olarak yayımlanır;
   `web-test` işi (lint, typecheck, test, build) geçmeden `build-web` çalışmaz, yani kırmızı commit'ten imaj üretilmez.

Coolify dışı sunucuda: `.env` dosyasını **depoya eklemeden** hazırlayıp `docker compose up -d --build`; önüne HTTPS
sonlandıran bir ters vekil koyun ve onun yazdığı IP başlığını `TRUSTED_IP_HEADER` ile belirtin.

## Veritabanı geçişleri (migrate)

- Betik: `web/scripts/migrate.mjs` (yalnızca `drizzle-orm` + `pg`; `create-admin.mjs` ile aynı kapanışta `bcryptjs`). `DATABASE_URL`'den bağlanır, `drizzle/` klasöründeki
  SQL migration'larını uygular (kayıt tablosu `drizzle.__drizzle_migrations`, `drizzle-kit migrate` ile aynı), PostgreSQL
  advisory lock alır (iki kapsayıcı aynı anda başlarsa biri bekler), hata olursa çıkış kodu 1 ile biter, her sonuç için
  tek satır yazar. İkinci çalıştırma işlem yapmaz (idempotent).
- İmajda: `/opt/migrator/migrate.mjs`, `/opt/migrator/create-admin.mjs` ve yalnızca bu betiklerin bağımlılıklarını (`drizzle-orm`, `pg`, `bcryptjs` + geçişli bağımlılıkları, `package-lock.json` sürümleriyle) içeren `/opt/migrator/node_modules`;
  migration SQL'leri `/app/drizzle` (`MIGRATIONS_FOLDER`).
- Elle çalıştırma (örnek, Coolify dışı sunucuda):
  `docker compose run --rm migrate`
- Migration başarısız olursa `web` başlamaz; eski web kapsayıcısı (varsa) çalışmaya devam eder. Günlük için
  `docker compose logs migrate`.
- Migration'lar **yalnızca ileri** yönlüdür; geri alma betiği yoktur (bkz. Geri alma).
- **Önemli (migration yazarları için)**: Drizzle migrator o çalıştırmada bekleyen TÜM migration'ları tek işlemde uygular.
  PostgreSQL, `ALTER TYPE ... ADD VALUE` ile eklenen enum değerinin aynı işlemde kullanılmasına izin vermez (tür
  önceki bir çalıştırmadan kalmışsa); bu durumda çalıştırmanın tamamı geri alınır ve `migrate` başarısız olur. Bu yüzden bir
  SQL migration'ı, `ADD VALUE` ile eklenmiş bir değeri (ekleyen dosya dahil, hiçbir sonraki dosyada) kullanmamalıdır;
  veri doldurma gerekiyorsa uygulama kodunda yapın. Ayrıntı ve otomatik denetim: `web/drizzle/README.md`.
- Herkese açık davet sayfası hız sınırı `public_rate_limits` tablosunu kullanır (migration 0006); tablo yalnızca
  bu `migrate` adımıyla oluşur, eski satırlar istekler sırasında temizlenir, ek bakım gerekmez.

## İlk yönetici

Uygulamada kayıt ekranı yoktur; ilk yönetici imajdaki düz Node betiğiyle açılır (`/opt/migrator/create-admin.mjs`,
kaynağı `web/scripts/create-admin.mjs`; `tsx`/TypeScript gerekmez). `docker-compose.yml` ve `docker-compose.coolify.yaml`
içinde `create-admin` adlı, `tools` profilindeki tek seferlik bir servis olarak tanımlıdır; `up` ile başlamaz. Veritabanı
`migrate` ile hazırlanmış olmalıdır (ilk dağıtım bittikten sonra çalıştırın).

```bash
# Parolayı standart girdiden verin (komut geçmişine ve süreç listesine düşmez):
printf %s "$YENI_PAROLA" | docker compose run --rm -T create-admin --password-stdin <kullanıcı-adı>

# ya da ortam değişkeniyle (değeri komutta yazmayın; ana makinede önceden dışa aktarılmış olsun):
ADMIN_PASSWORD="$YENI_PAROLA" docker compose run --rm create-admin <kullanıcı-adı> --email yonetici@sirket.com
```

- Parola en az 12 karakter olmalıdır; hiçbir çıktıya yazılmaz. E-posta verilmezse `<kullanıcı-adı>@eventflow.invalid` kullanılır.
- **Etkin bir yönetici zaten varsa betik hiçbir şey değiştirmeden çıkış kodu 2 ile biter.** Taşıma sonrası eski
  yöneticilerle girilecekse bu betiği çalıştırmayın (bkz. aşağıda taşıma notu).
- **Parola sıfırlama / kilitlenme**: `... create-admin --reset <kullanıcı-adı>` var olan yönetici hesabının parolasını
  değiştirir, hesabı yeniden etkinleştirir ve tüm oturumlarını siler. Yönetici olmayan bir kullanıcıyı yükseltmez.
- Çıkış kodları: 0 başarılı; 1 kullanım/doğrulama (parola kısa, kullanıcı adı geçersiz, `DATABASE_URL` yok); 2 etkin yönetici
  var; 3 kullanıcı adı/e-posta başka kullanıcıda; 4 `--reset` hedefi yok ya da yönetici değil; 5 veritabanı hatası
  (genellikle `migrate` çalışmamıştır). Her sonuç tek satırdır: `create-admin: yönetici oluşturuldu: <ad> (<id>)`.
- Coolify'da: aynı komutu sunucuda, Coolify'ın dağıttığı compose dizininde `docker compose --profile tools run --rm ...`
  ile ya da kapsayıcı terminalinden `node /opt/migrator/create-admin.mjs ...` ile çalıştırabilirsiniz (ortam
  değişkenleri `web` kapsayıcısında zaten vardır, `DATABASE_URL` dahil).
- Eski veri taşıma yolu: eski kullanıcılar (bcrypt parolalarıyla) taşınıyorsa taşıma sonrası eski yönetici hesabıyla girilir;
  taşımadan **önce** yönetici oluşturmayın (bkz. taşıma kılavuzu).
- Betik, uygulamanın kimlik doğrulamasıyla aynı kuralları uygular (bcrypt maliyeti 12, `credential` hesabı, kullanıcı
  adı büyük/küçük harf duyarlı). Oluşturulan yöneticinin gerçek Better Auth işleyicisiyle giriş yaptığı vitest ile
  doğrulandı (`web/tests/scripts/create-admin.test.ts`); **kapsayıcı içinde çalıştırılması denenmedi** (Docker yok).

## Eski veriyi taşıma (canlıya geçiş öncesi)

Tam kitap: [`web/scripts/migrate-legacy/README.md`](web/scripts/migrate-legacy/README.md) (bakım modu, yedek, hedefi
hazırlama, dry-run, rapor incelemesi, gerçek çalıştırma, doğrulama, geri alma). Burada yalnızca dikkat edilecekler:

- Taşıma betiği `LEGACY_DATABASE_URL`'den **salt-okunur** okur, hedefe tek işlemde yazar.
- Rezervasyon `qr_token` değerleri `BETTER_AUTH_SECRET` / `QR_SIGNING_KEY` ile imzalanır. Taşımayı çalıştırırken bu
  değişkenler **üretimdeki uygulamanın değerleriyle aynı olmalıdır**; yoksa taşınan rezervasyonların QR'ları doğrulanmaz.
  Üretimde `QR_SIGNING_KEY` kullanacaksanız onu da aynı değerle verin ve sonradan değiştirmeyin.
- Betik `tsx` ile çalışır; bu yüzden depoyu açan bir makineden (eski ve yeni veritabanına erişimi olan) çalıştırılır,
  imajın içinden değil.

## Yedek (geçişten önce)

Geçişe başlamadan, her biri sunucudan **dışarı kopyalanarak** saklanmak üzere:

```bash
# Eski veritabanı (PostgreSQL 15)
docker exec <eski-db-kapsayıcısı> pg_dump -U <kullanıcı> -Fc eventflow > eski-$(date +%F).dump
# Eski yüklemeler (volume uploads_data)
docker run --rm -v <proje>_uploads_data:/u -v "$PWD":/b alpine tar czf /b/eski-uploads-$(date +%F).tgz -C /u .
# Yeni veritabanı (taşımadan önce boş olsa da; sonraki yedekler için aynı komut)
docker compose exec -T postgres pg_dump -U "$DB_USERNAME" -Fc "$DB_NAME" > yeni-$(date +%F).dump
```

Yedeği geri yüklemeyi bir kez deneyin (`pg_restore --clean -d ...`). Eski yığının volume'larını **cutover sonrası da
en az birkaç hafta silmeyin**.

## Geçiş (cutover) ve geri alma

Geçiş:
1. Yedekleri alın. Eski uygulamayı bakım moduna alın (yazma durur).
2. Yeni yığını ayrı alan adı/porta kurup `migrate` ile şemayı hazırlayın; taşıma kılavuzunu (dry-run, rapor, gerçek)
   uygulayın; elle duman testi yapın (giriş, bir etkinliğin yerleşimi, bir QR check-in).
3. Alan adını yeni `web` servisine çevirin (Coolify'da alan adını atayın, eskisinden kaldırın).

Geri alma:
- **Uygulama sürümü kötüyse (şema uyumlu)**: `WEB_IMAGE=ghcr.io/optimus825482/eventflow-web:<önceki-sha>` verip yeniden
  dağıtın. Dikkat: `migrate` ileri yönlüdür; yeni migration'lar eski imajla uyumsuz olabilir. Şema değiştiyse
  yeni veritabanını bu dağıtımdan önce alınan yedekten geri yükleyin.
- **Yeni yığın tümden vazgeçilirse**: alan adını eski yığına çevirin ve eskiyi başlatın:
  Coolify'da `docker-compose.legacy.coolify.yaml` (GHCR'deki son `eventflow-backend`/`eventflow-frontend` imajlarını
  kullanır; bu imajları cutover onaylanana kadar silmeyin). Eski veritabanı
  taşıma sırasında hiç değiştirilmediği için olduğu gibi çalışır. Cutover sonrası eski uygulamaya yazılan veri yoksa kayıp
  olmaz; yeni uygulamada cutover sonrası girilen veriler eski yığına geri taşınmaz.

## Sahibin yapması gerekenler

Bunlar ajanın/otomasyonun yapamayacağı ya da yapmaması gereken işlerdir:

1. ~~Gmail SMTP uygulama parolasını iptal edin.~~ **Yapıldı (2026-11-22, sahibi iptal etti).** Yeni parolayı yalnızca
   yeni uygulamanın Ayarlar ekranından girin. Eski parola git geçmişinde `backend/seed-data.sql` dosyasında açıkta
   duruyor (dosya bu çalışmada bilerek açılmadı). Google Hesabı > Güvenlik > Uygulama parolaları'ndan ilgili parolayı
   silin; yenisini yalnızca yeni uygulamanın Ayarlar ekranından (şifreli saklanır) girin. Depo herkese açıksa ya da
   paylaşıldıysa parola ele geçmiş sayılmalıdır.
2. **(İsteğe bağlı) Git geçmişini yeniden yazın.** Dosyayı geçmişten silmek için `git filter-repo --path
   backend/seed-data.sql --invert-paths` gibi bir araçla tüm dallar ve etiketler yeniden yazılır, ardından zorla push
   gerekir; tüm klonlar ve çatallar yeniden alınmalıdır. 1. adım yapıldıktan sonra bu yalnızca temizlik içindir
   (parola zaten geçersizdir); geri döndürülemez bir işlem olduğu için yedek alıp sahibi karar vermelidir.
3. **Gerçek veri taşımasını çalıştırın** (yukarıdaki kılavuz) ve taşıma raporundaki tüm uyarıları gözden geçirin.
4. **Cutover'ı yapın** (alan adını yeni servise çevirin) ve elle duman testi yapın.
5. `backend/` ve `frontend/` dizinleri, kaynaktan derleyen `docker-compose.legacy.yml` ve eski imaj işleri sahibinin
   onayıyla kaldırıldı. Geri dönüş süresi dolduktan sonra `docker-compose.legacy.coolify.yaml`, `DEPLOYMENT_CHECKLIST.md`,
   GHCR'deki eski imajlar ve eski yığının volume'ları da kaldırılabilir.
6. Üretim gizli değerlerini (`BETTER_AUTH_SECRET`, `SETTINGS_ENCRYPTION_KEY`, `DB_PASSWORD`) üretip güvenli bir yerde
   (parola yöneticisi) yedekleyin; kaybedilen `BETTER_AUTH_SECRET`/`QR_SIGNING_KEY` basılı/dağıtılmış QR'ları geçersiz kılar.

## Sorun giderme

- `web` başlamıyor, günlükte "Geçersiz ortam değişkenleri": `BETTER_AUTH_URL` https mi, `TRUSTED_IP_HEADER` ve
  `BETTER_AUTH_SECRET` (en az 32 karakter) tanımlı mı?
- `migrate` başarısız: `docker compose logs migrate`; veritabanı bağlantısı/parola ve (parolada özel karakter varsa)
  URL kodlaması.
- Giriş sonrası hemen çıkış / çerez yok: `BETTER_AUTH_URL` gerçek alan adıyla birebir aynı olmalı ve istekler HTTPS ile
  gelmeli.
- Gerçek zamanlı güncellemeler gelmiyor: ters vekil `text/event-stream` yanıtını tamponluyor olabilir; ayrıca web'i tek
  kopya çalıştırın.

## Doğrulama durumu

- Yapıldı: `web/scripts/migrate.mjs`, boş bir geçici veritabanında (`localhost:54329`) iki kez ve iki eşzamanlı süreçle
  çalıştırıldı (idempotent, kilit çalışıyor, hatalı veritabanında çıkış kodu 1); bağımlılık kurulum adımı
  (`drizzle-orm` + `pg` ile ayrı `npm install`) betikle birlikte denendi; YAML dosyaları ayrıştırıldı.
- Ayrıca yapıldı: `migrate.mjs` boş geçici veritabanında 0000'dan 0006'ya temiz uygulandı; `create-admin.mjs`, imajdaki gibi
  `package-lock.json` kapanışıyla (16 paket) oluşturulmuş ayrı bir dizinden çalıştırıldı (oluşturma, ikinci çalıştırmada çıkış 2).
- Yapılmadı (Docker yok): imaj derlemesi, `create-admin` servisinin kapsayıcıda çalıştırılması, Coolify'ın `profiles` desteği, `docker compose config/up`, Coolify/Traefik davranışı, kapsayıcıda `migrate`
  ve `web` başlatma sırası, `/data/uploads` volume sahipliği, GitHub Actions `workflow_call` çağrısı.
