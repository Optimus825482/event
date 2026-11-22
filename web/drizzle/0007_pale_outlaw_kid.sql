ALTER TABLE "event_tables" ADD COLUMN "is_vip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "size" double precision;--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "floor" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "sort_number" integer;--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_floor_range" CHECK ("event_tables"."floor" BETWEEN 1 AND 9);