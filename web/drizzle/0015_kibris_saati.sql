-- Elle eklendi: varsayılan değişirken mevcut kurulumlar eski varsayılanda kalmasın; yalnızca Europe/Istanbul olan
-- satır Kıbrıs saatine çevrilir, yöneticinin elle yazdığı başka bir dilime dokunulmaz.
ALTER TABLE "system_settings" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Famagusta';--> statement-breakpoint
UPDATE "system_settings" SET "timezone" = 'Asia/Famagusta' WHERE "timezone" = 'Europe/Istanbul';
