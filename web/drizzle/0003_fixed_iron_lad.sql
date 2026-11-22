-- Sayaçlar geçicidir (15 dk); anahtar biçimi değiştiği için eski satırlar silinir.
DELETE FROM "login_attempts";--> statement-breakpoint
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_pkey";--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "ip" text NOT NULL;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_username_ip_pk" PRIMARY KEY("username","ip");
