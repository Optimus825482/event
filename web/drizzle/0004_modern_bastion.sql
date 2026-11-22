ALTER TABLE "check_in_events" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
ALTER TABLE "check_in_events" ADD COLUMN "response" jsonb;