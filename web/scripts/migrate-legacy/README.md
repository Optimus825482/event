# Eski veri taşıma (legacy → yeni şema)

Eski NestJS/TypeORM veritabanını **salt-okunur** okur ve yeni şemaya **tek işlemde** yazar.
Tasarım, eşleme kararları ve şema boşlukları: `.superpowers/sdd/2026-11-22-eventflow-yeniden-kurulum/task-21-report.md`.

```
LEGACY_DATABASE_URL=postgres://okuyucu@eski-host/eventflow \
DATABASE_URL=postgres://.../eventflow_yeni \
BETTER_AUTH_SECRET=<uygulamanınkiyle aynı> [QR_SIGNING_KEY=<uygulamanınkiyle aynı>] \
LEGACY_TZ=Europe/Istanbul \
npx tsx scripts/migrate-legacy/index.ts [--dry-run] [--report raporlar/taşıma] \
  [--force-empty-check=off] [--default-organizer <kullanıcı-uuid>]
```

- `LEGACY_TZ`: eski `timestamp without time zone` değerlerinin yazıldığı dilim (açık soru 3). Değer
  PostgreSQL'in `pg_timezone_names` listesinde olmalı.
- `BETTER_AUTH_SECRET` / `QR_SIGNING_KEY` uygulamanın üretim değerleriyle **aynı** olmalı: `qr_token`
  bu anahtarla imzalanır. Farklıysa taşınan rezervasyonların QR'ları uygulamada doğrulanmaz.
- `--report <yol>`: `<yol>.json` ve `<yol>.txt` yazar (kimlik ve etiket içerir, telefon/e-posta içermez).
  Konsol yalnızca sayıları yazar.
- Çıkış kodu: 0 başarılı (dry-run dahil), 1 hata/doğrulama başarısız (işlem geri alındı), 2 kullanım hatası.

## Çalıştırma kitabı

1. **Yazma durdurma.** Eski uygulamayı bakım moduna alın (açık soru 6). Taşıma tek seferliktir;
   artımlı eşitleme yoktur.
2. **Yedek.** Eski veritabanının ve (boş da olsa) hedefin yedeğini alın:
   `pg_dump -Fc -f eski.dump <eski>` ve `pg_dump -Fc -f hedef-oncesi.dump <hedef>`.
   Eski bağlantı için mümkünse yalnızca `SELECT` yetkili bir rol kullanın; betik ayrıca oturumu
   `default_transaction_read_only = on` ve `BEGIN READ ONLY` ile açar.
3. **Hedefi hazırla.** Boş veritabanında `npm run db:migrate` (son Drizzle migration'ı). Betik,
   hedef son migration'da değilse ya da alan tablolarında satır varsa çalışmaz. Yönetici hesabını
   taşımadan **önce** oluşturmayın (eski kullanıcılar taşınır; gerekirse sonra `create-admin`).
4. **Deneme (dry-run).** `--dry-run --report raporlar/deneme` ile çalıştırın. Tüm adımlar ve
   doğrulamalar çalışır, sonra işlem geri alınır; hedef boş kalır.
5. **Raporu inceleyin** (`raporlar/deneme.txt`). Özellikle:
   - `orphanTableReferences` / `placeholderTables`: yerleşimde olmayan masaya yapılmış
     rezervasyonlar için "Eski …" etiketli, (0,0) konumlu yer tutucu masalar oluşturulur. Taşıma
     sonrası yerleşim düzenleyicide konumlandırın ya da rezervasyonu doğru masaya taşıyın.
   - `conflictingReservations`: aynı masadaki ikinci aktif rezervasyon `cancelled` taşınır; gerekçe
     rezervasyona bağlı müşteri notundadır. Gerçekten iki masa gerekiyorsa taşımadan sonra düzeltin.
   - `capacityRaised`: eski sistem masa kapasitesini denetlemiyordu; kişi sayısı masanın kapasitesini
     aşan **aktif** rezervasyonlar silinmez ve kişi sayısı kısaltılmaz. Bunun yerine masanın kapasitesi
     o masadaki en büyük aktif kişi sayısına yükseltilir (yoksa yeni uygulama o rezervasyonu
     düzenlemeyi ve yerleşimi kaydetmeyi reddederdi). Listelenen her masayı/rezervasyonu (eski ve yeni
     kapasite, rezervasyon kimlikleri) sahibiyle gözden geçirin; iptal edilmiş rezervasyonlar sayılmaz.
   - `customerCounterChanges`: müşteri sayaçları (`total_reservations`, `no_show_count`,
     `total_attended_events`) eski değerlerden kopyalanmaz; taşınan rezervasyon satırlarından
     uygulamanın kuralıyla yeniden hesaplanır (iptal edilmeyenler, `no_show`, `checked_in`). Eski
     değerden farklı olanlar burada eski/yeni değerle listelenir (çakışma nedeniyle iptal edilenler,
     müşteri birleştirmeleri). `event_count`, `total_spent`, `last_event_*` rezervasyondan türetilemez
     ve eski değerleriyle kalır.
   - `unmatchedStaff`, `userStaffLinks`, `unresolvedStaffReferences`: kullanıcı ↔ personel eşlemesi.
     Ad soyadla (`matchedBy=fullName`) yapılan eşleşmeleri gözle doğrulayın.
   - `caseOnlyUsernames`: iki hesap da korunur; giriş büyük/küçük harf duyarlıdır.
   - `eventsWithoutOrganizer`: varsayılan organizatör (en eski etkin admin) atanır;
     başka biri isteniyorsa `--default-organizer` verin.
   - `customerMerges`, `customersFromGuest`, `placeholderCustomers`, `userIdentityFixes`,
     `nonBcryptPasswords`, `skippedRows` ve **Şema boşlukları** bölümü (dolu satır > 0 olanlar kayıptır).
   Kaynak veride düzeltilmesi gerekenleri eski sistemde (yazma durdurulmadan önce) ya da kabul
   edilen kararla düzeltin ve 4. adımı tekrarlayın. Rapor temizlenmeden canlı geçiş yapılmaz.
6. **Gerçek çalıştırma.** Aynı komutu `--dry-run` olmadan, `--report raporlar/gercek` ile çalıştırın.
   Sonuç `committed` olmalı; aksi halde işlem geri alınmıştır ve hedef değişmemiştir.
7. **Doğrulama.** Raporun "Doğrulama" bölümündeki her satır OK olmalı; kapasite aşımı ya da sayaç uyumsuzluğu varsa
   doğrulama başarısız olur ve tüm işlem geri alınır (satır sayısı uzlaştırma,
   her rezervasyonun masası/müşterisi, masa başına tek aktif rezervasyon, **hiçbir aktif rezervasyonun masa kapasitesini aşmaması**,
   **müşteri sayaçlarının rezervasyon satırlarıyla uyumu**, her kullanıcının parola
   hesabı, QR imzaları, dekor biçimi, varsayılanlar/diziler). Ek olarak elle: birkaç eski kullanıcıyla
   giriş, bir etkinliğin yerleşimi, bir rezervasyonun QR check-in'i.
8. **Geri alma.** Betik eski veritabanına hiç yazmaz. Geri dönüş = hedefi 2. adımdaki yedekten geri
   yükleyip (`pg_restore --clean -d <hedef> hedef-oncesi.dump`, ya da veritabanını silip yeniden
   oluşturup migrate etmek) eski uygulamayı yeniden açmaktır.

## Testler

`npx vitest run tests/scripts/migrate-legacy` (web/ dizininden). Testler özel kümede
(`localhost:54329`) `eventflow_legacy_test_*` (eski şema dökümü + sentetik veri) ve
`eventflow_etl_test_*` (Drizzle migration'larıyla) veritabanları oluşturur ve sonunda siler.
Gerçek veri içeren hiçbir döküm kullanılmaz.
