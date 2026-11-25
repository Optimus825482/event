-- Elle yazıldı (drizzle-kit generate bu değişiklikte etkileşimli yeniden adlandırma sorusu sorar ve
-- eski veriyi dönüştüremez). Neden: bildirim hedefi rolden departman kitlesine geçti.
-- Sıra: sütunu text'e çevir -> eski değerleri eşle (leader -> fnb, staff -> casino) -> eski türü sil ->
-- yeni türü oluştur -> sütunu yeni türe çevir ve `audience` olarak yeniden adlandır.
-- Not (drizzle/README.md Kural 2): ADD VALUE kullanılmaz; tür baştan yaratıldığından bu dosya kendi içinde tutarlıdır.
ALTER TABLE "notifications" ALTER COLUMN "target_role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "target_role" SET DATA TYPE text USING "target_role"::text;--> statement-breakpoint
UPDATE "notifications" SET "target_role" = 'fnb' WHERE "target_role" = 'leader';--> statement-breakpoint
UPDATE "notifications" SET "target_role" = 'casino' WHERE "target_role" = 'staff';--> statement-breakpoint
DROP TYPE "public"."notification_target_role";--> statement-breakpoint
CREATE TYPE "public"."notification_audience" AS ENUM('all', 'admin', 'entertainment', 'fnb', 'casino');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "target_role" SET DATA TYPE "public"."notification_audience" USING "target_role"::"public"."notification_audience";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "target_role" SET DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "notifications" RENAME COLUMN "target_role" TO "audience";--> statement-breakpoint
ALTER INDEX "notifications_target_role_created_at_idx" RENAME TO "notifications_audience_created_at_idx";
