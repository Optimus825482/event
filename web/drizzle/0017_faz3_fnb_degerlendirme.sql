-- Elle eklenen satır: table_groups.group_type serbest metindi; canlıdaki 'standard'/'loca' dışı değerler yeni CHECK'i bozmasın diye önce 'standard'a çekilir.
CREATE TABLE "event_section_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_section_heads_event_staff_uq" UNIQUE("event_id","staff_id")
);
--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD COLUMN "form_kind" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD COLUMN "overall_rating" smallint;--> statement-breakpoint
ALTER TABLE "event_section_heads" ADD CONSTRAINT "event_section_heads_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_section_heads" ADD CONSTRAINT "event_section_heads_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_section_heads" ADD CONSTRAINT "event_section_heads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_section_heads_staff_id_idx" ON "event_section_heads" USING btree ("staff_id");--> statement-breakpoint
UPDATE "table_groups" SET "group_type" = 'standard' WHERE "group_type" NOT IN ('standard','loca');--> statement-breakpoint
ALTER TABLE "table_groups" ADD CONSTRAINT "table_groups_group_type_valid" CHECK ("table_groups"."group_type" IN ('standard','loca'));--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_form_kind_valid" CHECK ("staff_performance_reviews"."form_kind" IN ('short','full'));--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_overall_range" CHECK ("staff_performance_reviews"."overall_rating" IS NULL OR "staff_performance_reviews"."overall_rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_short_complete" CHECK ("staff_performance_reviews"."form_kind" <> 'short' OR "staff_performance_reviews"."is_completed" = false OR "staff_performance_reviews"."overall_rating" IS NOT NULL);