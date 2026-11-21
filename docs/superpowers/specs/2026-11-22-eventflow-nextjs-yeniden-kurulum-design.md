# EventFlow PRO — Tek Next.js Uygulaması ve Yeni Şema ile Yeniden Kurulum

Tarih: 2026-11-22 · Durum: onay bekliyor

## 1. Amaç ve neden

EventFlow PRO bugün Next.js 16 arayüz + ayrı NestJS 11/TypeORM servisi + PostgreSQL olarak çalışıyor. Analiz, hataların büyük kısmının tek bir kökten geldiğini gösterdi: masalar veritabanında tablo değil, `events.venueLayout` JSON'unun içinde. Buna bağlı olarak çifte rezervasyon ve çifte check-in mümkün, kapasite kontrolü sessizce atlanıyor, yetkilendirme büyük oranda yok ve şema sıfırdan kurulamıyor.

Hedef: aynı işlevi, bu hata sınıflarını yapısal olarak imkânsız kılan tek bir Next.js + PostgreSQL uygulamasında yeniden kurmak ve mevcut veriyi kayıpsız taşımak.

## 2. Hedefler, hedef dışı, başarısızlık sayılacaklar

**Hedefler**
- Tek uygulama, tek konteyner, tek tip sistemi; arayüz sayfaları veriyi sunucuda çeker.
- Masa, rezervasyon, atama ilişkileri veritabanı kısıtlarıyla korunur.
- Her yazma işlemi merkezi bir yetki denetiminden geçer; varsayılan davranış reddetmektir.
- Boş bir veritabanı tek komutla (`migrate`) kurulabilir.
- Analizde belirlenen 15 kritik davranış otomatik testle sabitlenir; CI lint, tip denetimi, test ve derlemeyi çalıştırır.
- Mevcut veri (yaklaşık 446 personel, 7 etkinlik, 1.318 atama) dönüşüm betiğiyle taşınır.

**Hedef dışı**
- Yeni özellik: SMS, PDF bilet, şikâyete göre masa önerisi, yanıt süresi kaydı.
- 3B önizlemenin yeniden tasarımı (olduğu gibi taşınır, tembel yüklenir).
- Görsel tasarımın değiştirilmesi (mevcut shadcn bileşenleri ve Tailwind teması korunur).
- Çok kiracılı (multi-tenant) yapı.

**Başarısızlık sayılacaklar**
- Masaların veya masa referanslarının yeniden JSON/dizi içinde tutulması.
- Yetkinin yalnızca istemcide veya yalnızca arayüzde denetlenmesi.
- Deneme taşıması (dry-run) ve yetim kayıt raporu olmadan canlı geçiş.
- 400 satırı aşan bileşen veya servis dosyaları.

## 3. Kısıtlar

- Dağıtım Coolify üzerinde Docker ile kalır (kalıcı disk ve uzun ömürlü bağlantı mevcut; sunucusuz ortam varsayılmaz).
- Eski sistem, geçiş tamamlanana kadar çalışmaya devam eder; yeni uygulama depoda `web/` klasöründe ayrı kurulur, `backend/` ve `frontend/` geçişten sonra kaldırılır.
- Mevcut kullanıcı parolaları bcrypt (cost 12) hash'i olarak taşınır; kullanıcılar parolalarını yeniden belirlemek zorunda kalmaz.
- Depodaki proje kuralı sürer: şema yalnızca migration ile değişir.

## 4. Değerlendirilen yaklaşımlar

| | Yaklaşım | Artı | Eksi |
|---|---|---|---|
| A | Tek Next.js, yeni şema, veri dönüşümü | Kök nedenleri kapatır; kısıtlar veritabanında | En çok iş; dönüşüm betiği riski |
| B | Tek Next.js, mevcut şema | Hızlı; dönüşüm yok | JSON masalar ve aynı hata sınıfı taşınır |
| C | NestJS kalır, yerinde onarım | Güvenlik için en kısa yol | Performans kazancı yok; iki kod tabanı |

**Seçilen: A** (kullanıcı kararı, 2026-11-22). Gerekçe: çifte rezervasyon ve format uyumsuzluğunu kökten kapatan tek seçenek.

## 5. Mimari

Aşağıdaki teknoloji seçimleri kullanıcının değil, bu belgeyi yazanın kararıdır; itiraza açıktır.

- **Çatı:** Next.js 16 App Router, `output: "standalone"`, React 19, TypeScript `strict`.
- **Veri erişimi:** Drizzle ORM + drizzle-kit migration'ları, `pg` bağlantı havuzu. Kısmi tekil index, GIN ve `timestamptz` desteği nedeniyle seçildi.
- **Okuma:** Sunucu Bileşenleri veriyi doğrudan sorgular. **Yazma:** Server Action'lar; dış istemci gerektiren uçlar (QR check-in, dosya, SSE) Route Handler olur.
- **Girdi doğrulama:** Her action ve handler girişinde Zod şeması; doğrulanmamış girdi iş mantığına ulaşmaz.
- **İstemci durumu:** Etkileşimli ekranlarda (tuval, check-in) TanStack Query + Zustand; `useEffect` içinde veri çekme kullanılmaz.
- **Kimlik doğrulama:** Sunucu taraflı oturum, `httpOnly` + `Secure` + `SameSite=Lax` çerez; oturumlar veritabanında tutulur ve iptal edilebilir. Kütüphane: Better Auth (Drizzle bağdaştırıcısı, bcrypt doğrulaması ile eski hash'ler). Plan aşamasında güncel belgeyle doğrulanır; uymazsa aynı sözleşmeyle kendi oturum tablomuz yazılır.
- **Yetkilendirme:** Tek bir `authorize(kullanıcı, eylem, kaynak)` işlevi. Rol (6 rol) + modül izni (`user_permissions`) birlikte değerlendirilir. Her action ilk satırda çağırır; çağırmayan action'ı yakalayan bir test bulunur. Herkese açık kayıt kapatılır; kullanıcıyı yönetici oluşturur.
- **Rota koruması:** `proxy.ts` oturum varlığını, sayfa/action ise yetkiyi denetler.
- **Canlı güncelleme:** Socket.IO kaldırılır. Sunucudan istemciye olaylar SSE Route Handler + PostgreSQL `LISTEN/NOTIFY` ile gider; istemciden sunucuya olaylar (masa taşıma, check-in) normal action'dır. Böylece her olay yetki denetiminden geçer ve tek konteyner yeterli olur.
- **Dosyalar:** Kalıcı birimde `uploads/`; dosya adı sunucuda rastgele üretilir, görseller `sharp` ile yeniden kodlanır, içerik türü dosya imzasından doğrulanır, sunum yetki denetimli bir handler üzerinden yapılır.
- **Excel içe aktarma:** Ayrıştırma sunucuda, tek bir hat. `xlsx@0.18.5` bilinen açıkları nedeniyle `exceljs` ile değiştirilir. İçe aktarılan satırlar manuel rezervasyonla aynı servis işlevinden geçer.
- **E-posta:** nodemailer; SMTP parolası veritabanında şifreli saklanır ve hiçbir yanıtta dönmez.
- **Kod yapısı:** `web/src/features/<alan>/{schema,queries,actions,components}`; alanlar: auth, events, venue, reservations, check-in, customers, staff, teams, invitations, reviews, notifications, settings, import.

## 6. Veri modeli ilkeleri

- Tüm adlar `snake_case`; birincil anahtarlar `uuid` (`gen_random_uuid()`); tüm zamanlar `timestamptz`; para `numeric(12,2)` + para birimi sütunu.
- **`event_tables`**: masalar gerçek satırdır (etkinlik, etiket, tür, kapasite, konum, dönüş). Dekor ve sahne gibi masa olmayan öğeler `events.layout_decor` JSONB'sinde kalabilir.
- **`reservations.table_id`** → `event_tables` yabancı anahtarı. Kısmi tekil index: `(event_id, table_id) WHERE status IN ('pending','confirmed','checked_in')`. Çifte rezervasyon veritabanında imkânsızdır.
- **Check-in** koşullu tek `UPDATE … WHERE status IN (…) RETURNING` ile yapılır; müşteri sayacı aynı transaction'da artar. Çevrimdışı kuyruk için `idempotency_key` (tekil) ve istemci zaman damgası saklanır.
- **Kişiler:** `staff` kişi kaydıdır; `users` oturum hesabıdır ve isteğe bağlı tekil `staff_id` ile bağlanır. Performans değerlendirmeleri `staff`'a bağlanır.
- **Atamalar:** üç atama tablosu tek `event_staff_assignments` + `assignment_tables` bağlantı tablosunda birleşir; `(event_id, staff_id, shift_id)` tekildir.
- **Ekipler ve gruplar:** `teams` + `team_members`; `table_groups` + `table_group_tables`, `(event_id, table_id)` tekil (bir masa tek gruba ait).
- **Kataloglar:** departman, pozisyon, görev yeri `staff`'a yabancı anahtarla bağlanır.
- **Durum makineleri:** etkinlik ve rezervasyon durum geçişleri kodda tek bir geçiş tablosunda tanımlanır; geçersiz geçiş reddedilir.
- **Tek QR formatı:** imzalı (HMAC) opak belirteç; masa bilgisi QR içinde taşınmaz, sunucudan okunur.
- Toplu ve yıkıcı işlemler (şablon uygulama, toplu atama) tek transaction içinde çalışır; ekip kimlikleri güncellemede korunur.

## 7. Test ve doğrulama

- Vitest; servis testleri gerçek PostgreSQL'e karşı çalışır (CI'da servis konteyneri).
- Analizdeki 15 kritik davranışın her biri için en az bir test; eşzamanlılık testleri (aynı masaya iki rezervasyon, aynı QR ile iki check-in) paralel isteklerle yazılır.
- Mevcut 3 check-in özellik testi (property-based) taşınır.
- Playwright ile uçtan uca: giriş, rezervasyon oluşturma, QR check-in, masa yerleşimi kaydetme.
- CI: lint → tip denetimi → test → derleme; herhangi biri başarısızsa imaj üretilmez.

## 8. Veri taşıma

- Eski veritabanından salt-okunur okuyan, yeni şemaya yazan, yeniden çalıştırılabilir bir betik.
- Sıra: kataloglar → kişiler (`users`↔`staff` eşlemesi) → etkinlikler → `venueLayout` içinden `event_tables` → rezervasyonlar → atamalar/ekipler/gruplar → değerlendirmeler.
- Her çalıştırma bir rapor üretir: yetim masa referansları, eşleşmeyen personel, çakışan rezervasyonlar. Rapor temizlenmeden canlı geçiş yapılmaz.
- Betik her iki yerleşim formatını (`tables` ve `placedTables`) okur.
- Saat dilimi dönüşümü, eski verinin hangi dilimde yazıldığı doğrulandıktan sonra sabitlenir (açık soru 3).

## 9. Aşamalar

| Aşama | İçerik |
|---|---|
| 0 | Mevcut sistemde acil önlemler: SMTP parolası iptali, kaydın kapatılması, açık uçların korunması, kişisel verinin depodan çıkarılması |
| 1 | `web/` iskeleti, şema ve migration'lar, kimlik doğrulama, yetki katmanı, CI |
| 2 | Paralel alanlar: etkinlik + mekân, müşteri, personel + ekip, davetiye, ayarlar + kullanıcı yönetimi |
| 3 | Rezervasyon ve check-in, eşzamanlılık testleriyle |
| 4 | Canlı güncelleme, çevrimdışı check-in, Excel içe aktarma, değerlendirmeler, bildirimler |
| 5 | Veri taşıma denemesi, uçtan uca testler, geçiş, eski kodun kaldırılması |

## 10. Uygulayıcıya bırakılanlar

Dosya ve bileşen adları, sayfa içi düzen ayrıntıları, sorgu biçimleri, index ayarları, tuval durumunun iç yapısı, hata mesajı metinleri.

## 11. Açık sorular (kullanıcı kararı)

1. NO_SHOW işaretlenmiş misafir sonradan check-in yapabilsin mi? (Bugün yapabiliyor.)
2. Kara listedeki müşteriye rezervasyon engellensin mi? (Bugün yalnızca uyarı veriyor.)
3. Mevcut tarih/saat verisi hangi saat diliminde yazıldı (UTC mi, Europe/Istanbul mu)?
4. Excel'i Mistral yapay zekâsıyla ayrıştırma korunacak mı? (Personel verisi üçüncü tarafa gidiyor.)
5. Git geçmişindeki kişisel veri ve parola geçmişten de silinsin mi? (Geçmişi yeniden yazmak geri alınamaz ve tüm kopyaları etkiler.)
6. Canlı geçiş için birkaç saatlik yazma durdurma (bakım penceresi) kabul ediliyor mu ve önümüzdeki etkinlik takvimi nedir? Kabul edilirse taşıma tek seferlik olur; edilmezse artımlı eşitleme gerekir ve Aşama 5 büyür.

## 12. İnceleme sonrası netleştirilenler

**Koddan doğrulananlar**
- Bir masada aynı anda tek aktif rezervasyon olur (`reservations.service.ts:65-90`); masa paylaşımı yoktur. Kısmi tekil index bu kuralı aynen uygular. Taşıma raporu, eski veride aynı masada birden çok aktif rezervasyon varsa bunları listeler.
- Roller: `admin`, `organizer`, `staff`, `leader`, `controller`, `venue_owner` (`user.entity.ts:14`). Yeni sistemde birebir korunur.
- "Aynı işlev"in ölçütü mevcut koddur: `frontend/src/app` altındaki 43 sayfa ve `backend/src/modules` altındaki controller'lar. Arşivlenmiş sayfalar (`staff_archived`, `team_archived`) ve `backend/excel-viewer-pro` kapsam dışıdır. Excel sütun kuralları ve yinelenen satır davranışı için kaynak `backend/src/modules/excel-import` kodudur; tek fark, satırların manuel rezervasyonla aynı kurallardan geçmesidir.

**Belgeyi yazanın kararları (itiraza açık)**
- Başlangıç yetki matrisi mevcut sayfa korumalarından alınır ve modül izinleriyle daraltılabilir:

  | Alan | admin | organizer | staff | leader | controller | venue_owner |
  |---|---|---|---|---|---|---|
  | Kullanıcı ve sistem ayarları, SMTP | ✔ | – | – | – | – | – |
  | Etkinlik, mekân, personel, ekip, davetiye, müşteri | ✔ | ✔ | – | – | – | – |
  | Rezervasyon ve misafir | ✔ | ✔ | ✔ | – | – | – |
  | Check-in | ✔ | ✔ | ✔ | ✔ | ✔ | – |
  | Ekip değerlendirme (yalnızca kendi ekibi) | ✔ | ✔ | – | ✔ | – | – |
  | Kendi mekân şablonları | ✔ | ✔ | – | – | – | ✔ |

- Anonim erişim yalnızca şunlarda vardır: giriş, sağlık denetimi (ayrıntısız), belirteçli davetiye görüntüleme. Check-in, walk-in ve misafir sayısı güncelleme oturum gerektirir (kapı personeli `controller` hesabıyla girer). Giriş ve davetiye uçlarında IP başına hız sınırı uygulanır.
- Daha önce dağıtılmış QR kodları çalışmaya devam eder: eski `qrCodeHash` değeri taşınır ve check-in ucu hem yeni imzalı belirteci hem eski hash'i kabul eder. Yeni üretilen tüm QR'lar tek formattadır.
- Çevrimdışı check-in: PWA ve çevrimdışı kuyruk korunur (tek IndexedDB şeması, tek kuyruk). Eşitlemede sunucu durumu geçerlidir: ilk check-in kazanır, tekrar gönderim hata değil "zaten yapıldı" döner, bu arada iptal edilmiş rezervasyon reddedilir ve operatöre gösterilir. İstemci zaman damgası kayıt için saklanır, sıralamayı belirlemez. Service worker kimlik doğrulamalı API yanıtlarını önbelleğe almaz.
- Ölçek varsayımı: tek işletme, etkinlik başına en çok birkaç bin misafir, onlarca eşzamanlı personel ve SSE bağlantısı. Bağlantı havuzu 20; SSE için tek paylaşımlı `LISTEN` bağlantısı kullanılır.

## 13. Testle sabitlenecek 15 davranış

1. Aynı masaya eşzamanlı iki rezervasyondan yalnızca biri başarılı olur.
2. Aynı QR ile eşzamanlı iki check-in: tek başarı, müşteri sayacı +1.
3. İptal edilmiş veya check-in yapılmış rezervasyon check-in yapamaz; NO_SHOW kuralı açık soru 1'e göre.
4. Kişi sayısı masa kapasitesini aşarsa reddedilir; kapasitesiz masa oluşturulamaz.
5. Kapasite, müsait masa listesi ve masa etiketi tek kaynaktan (`event_tables`) gelir.
6. İptal → onaylı geçişi müsaitlik denetiminden geçer.
7. Masa değişince QR doğrulaması yeni masayı döndürür.
8. Excel içe aktarma, manuel rezervasyonla aynı müsaitlik, kapasite ve QR kurallarını uygular.
9. Toplu NO_SHOW yalnızca bitmiş etkinlikte çalışır ve müşteri sayaçlarını günceller.
10. Bir masa, etkinlik içinde tek gruba ve tek ekibe aittir; her yazmada korunur.
11. Şablon uygulama ve toplu atama atomiktir; hata olursa eski durum kalır, özel görevler kaybolmaz.
12. Değerlendirme puan formülü (ağırlıklar 15/15/15/20/10/10/5/10) ve eşik sınırları (89/90, 79/80, 59/60, 39/40, 19/20).
13. Değerlendirme kapalıyken yazılamaz; tamamlanan değerlendirme kilitlenir; lider yalnızca kendi ekibini değerlendirir.
14. Etkinlik durum geçiş matrisi (ör. tamamlandı → taslak yasak).
15. Telefon veya e-posta ile eşzamanlı müşteri oluşturmada mükerrer kayıt oluşmaz.
