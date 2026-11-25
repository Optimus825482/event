# Migration yazarları için kurallar

Bu klasör `drizzle-kit generate` çıktısıdır (SQL + `meta/`); migration'ları elle değiştirmeyin (zorunluysa nedenini
migration dosyasının başına yorum olarak yazın, `0003` gibi). Uygulama: geliştirmede `npm run db:migrate`
(`drizzle-kit`), üretimde `web/scripts/migrate.mjs`; ikisi de Drizzle'ın migrator'ını kullanır.

## Kural 1 - bekleyen migration'lar TEK işlemde uygulanır

Drizzle'ın PostgreSQL migrator'ı (`pg-core/dialect.js`, `migrate()`), o çalıştırmada bekleyen **tüm** migration
dosyalarını tek bir `BEGIN ... COMMIT` içinde uygular; hata olursa hepsi geri alınır (kayıt tablosu da dahil).
Sonuçları:

- Boş veritabanına 0000'dan en sona uygulama tek işlemdir; üretimde bir sürüm atlayan güncelleme de öyle.
- Kısmi ilerleme yoktur: 0007 hatalıysa 0005 ve 0006 da uygulanmamış kalır.
- `CREATE INDEX CONCURRENTLY`, `VACUUM` gibi işlem içinde çalışmayan komutlar migration'a konamaz.

## Kural 2 - `ALTER TYPE ... ADD VALUE` ile eklenen değeri SQL migration'ında KULLANMAYIN

PostgreSQL 12+ `ADD VALUE`'nun işlem içinde çalışmasına izin verir, ama yeni değer **işlem tamamlanana kadar
kullanılamaz** (`unsafe use of new value`, SQLSTATE 55P04). Tek işlem kuralı yüzünden:

| Durum | Sonuç |
| --- | --- |
| Boş veritabanı; enum türü de aynı çalıştırmada yaratılıyor (0000...) | Çalışır (aynı işlemde yaratılan türün değerleri güvenlidir) |
| Tür önceki bir sürümden kalma; aynı çalıştırmada hem `ADD VALUE` hem o değeri kullanan migration var | **Başarısız olur, hepsi geri alınır** (örn. 0005'i henüz almamış bir veritabanı, 0005 + "reviews" satırı yazan 0006 ile güncellenirse) |
| `ADD VALUE` migration'ı öncekilerden ayrı bir dağıtımda uygulanmış, kullanan migration sonraki dağıtımda | Çalışır, ama aralarını atlayan (staging, geç güncellenen kurulum) bir veritabanında yukarıdaki satıra düşer |

Kural: **Bir migration, `ADD VALUE` ile eklenmiş bir değeri (kendi dosyasında ya da sonraki hiçbir dosyada) SQL olarak
kullanmaz** - `INSERT`/`UPDATE`/`DEFAULT`/`CHECK`/kısmi indeks `WHERE` içinde değer sabiti geçmez. Seçenekler:

1. Veri doldurmayı uygulama kodunda yapın (yönetici eylemi, ilk istekte tohumlama).
2. Değeri kullanan nesneyi enum yerine `text` + `CHECK` ile kurun; ya da türü yeniden yaratın
   (`CREATE TYPE ..._new`, sütunu `USING` ile çevir, eskisini sil) - bu dosya kendi içinde tutarlıdır.
3. Migration çalıştırıcısını değiştirmek (her dosyayı ayrı işlemde uygulamak) bilerek yapılmadı: geliştirme
   (`drizzle-kit migrate`) ve testler (`tests/helpers/db.ts`) Drizzle'ın tek işlemli migrator'ını kullanır; üretimde
   farklı davranan bir migrator, CI'da geçip üretimde (ya da tersi) farklı sonuç vermesine yol açar.

Otomatik denetim: `web/tests/scripts/migrate-runtime.test.ts` (a) gerçek klasörde yukarıdaki kuralı ihlal eden bir
ifade olmadığını, (b) kuralın dayandığı davranışı gerçek `migrate.mjs` ile geçici bir veritabanında sınar.

## Kural 3 - izlenen dosyalar

`*.sql` ve `meta/*.json` git'te tutulur (kökteki `.gitignore` `*.sql` desenine rağmen `web/drizzle/` istisnadır; yeni
dosyanın `git status`'ta göründüğünü kontrol edin). Üretilen SQL'i her zaman okuyun: `drizzle-kit` birincil anahtar
değişikliği gibi bazı durumlarda hatalı SQL üretebilir (bkz. `0003`).

## Kural 4 - paralel dallarda migration

Birden çok dal aynı anda çalışıyorsa (paralel worktree'ler, bkz. `docs/superpowers/plans/2026-11-26-faz2-3-paralel-yurutme.md`):

- **Numaralar ayrılmıştır.** Her fazda migration üreten tek görev vardır; numarasını entegratör ayırır, başka görev `drizzle/` klasörüne dokunmaz. Gerekirse görev durur ve entegratöre sorar.
- **Migration commit'i görevin son ve ayrı commit'idir.** Journal (`meta/_journal.json`) ve snapshot dosyaları **asla elle birleştirilmez**; çatışmada migration commit'i düşürülüp `npm run db:generate` ile yeniden üretilir.
- **Yeniden üretimden sonra şeridin veritabanları sıfırlanır.** Drizzle, kayıtlı son migration'ın `created_at`'inden eski `when` değerli girdiyi uygulamaz; eski numaralı kayıt kalan bir veritabanında yeni migration sessizce atlanır ve test eksik şemayla yeşil görünür. Test veritabanı için `npm run db:drop-test` (sonraki `npm test` yeniden kurar), geliştirme veritabanı için düşürüp `npm run db:migrate` çalıştırın.
- **Otomatik denetim:** `web/tests/scripts/migration-journal.test.ts` journal bütünlüğünü sınar: `idx` değerleri 0'dan kesintisiz, etiketler numarayla başlar, `when` değerleri kesin artan, her girdinin SQL ve snapshot dosyası var, snapshot `prevId` zinciri kopuk değil ve journal'a girmemiş `.sql` dosyası yok.
