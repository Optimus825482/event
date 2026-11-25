-- Elle yazıldı (drizzle-kit çıktısı eski değerleri dönüştürmez ve varsayılanı türden önce yazar). Neden: altı
-- sabit rol kalktı; rol yalnızca `admin | user`, yetki departman üyeliklerinden gelir.
-- Sıra: rol varsayılanını kaldır, sütunu text'e çevir -> eski rol türünü sil -> yalnızca admin ve user değerleriyle
-- yeniden oluştur -> departman kullanıcısı olmayanların (eski roller ve yöneticiler) izin satırlarını sil (eski modelde
-- kısıt anlamındaydı; yeni modelde verilen yetkidir; yönetici satırları zaten etkisizdir) -> eski rollü kullanıcıların
-- üyeliklerini sil ve rollerini `user` yap -> sütunu yeni türe çevir, varsayılan `user` -> `can_view` varsayılanı false.
-- 0013 durumundaki veritabanında departman kullanıcılarının üyelikleri ve izin satırları korunur.
-- Eski rollü kullanıcı (geliştirici veritabanları) üyeliksiz `user` olur: giriş yapabilir ama yönetici departman
-- atayana kadar hiçbir modüle erişemez. Hiçbir eski rol `admin`e ya da bir üyeliğe eşlenmez.
-- Not (drizzle/README.md Kural 2): 0012 user değerini ADD VALUE ile ekler ve bu dosyayla aynı işlemde
-- uygulanabilir. Burada bu değer yalnızca text sütunda ve baştan yaratılan türde kullanılır (aynı işlemde
-- yaratılan türün değerleri güvenlidir); eski türün eklenmiş değeri hiçbir ifadede kullanılmaz.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
DELETE FROM "user_permissions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "role" <> 'user');--> statement-breakpoint
DELETE FROM "department_memberships" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "role" NOT IN ('admin', 'user'));--> statement-breakpoint
UPDATE "users" SET "role" = 'user' WHERE "role" <> 'admin';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "user_permissions" ALTER COLUMN "can_view" SET DEFAULT false;
