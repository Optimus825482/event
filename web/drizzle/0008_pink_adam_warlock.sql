-- Elle eklendi (drizzle/README.md: elle değişikliğin nedeni başa yazılır): yeni CHECK kısıtlarından önce eksik/eşit özel saatli
-- eski atama satırları vardiya saatine döndürülür (iki saat de NULL), böylece mevcut satırlar geçerli kalır.
CREATE TABLE "service_point_role_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"service_point_id" uuid NOT NULL,
	"role" text NOT NULL,
	"required_count" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_point_role_requirements_point_role_uq" UNIQUE("service_point_id","role"),
	CONSTRAINT "service_point_role_requirements_count_positive" CHECK ("service_point_role_requirements"."required_count" > 0),
	CONSTRAINT "service_point_role_requirements_role_not_blank" CHECK (btrim("service_point_role_requirements"."role") <> '')
);
--> statement-breakpoint
ALTER TABLE "service_point_role_requirements" ADD CONSTRAINT "service_point_role_requirements_service_point_fk" FOREIGN KEY ("event_id","service_point_id") REFERENCES "public"."service_points"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_point_role_requirements_point_idx" ON "service_point_role_requirements" USING btree ("event_id","service_point_id");--> statement-breakpoint
UPDATE "event_staff_assignments" SET "shift_start" = NULL, "shift_end" = NULL WHERE ("shift_start" IS NULL) <> ("shift_end" IS NULL) OR "shift_start" = "shift_end";--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_shift_times_paired" CHECK (("event_staff_assignments"."shift_start" IS NULL) = ("event_staff_assignments"."shift_end" IS NULL));--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_shift_times_distinct" CHECK ("event_staff_assignments"."shift_start" IS NULL OR "event_staff_assignments"."shift_start" <> "event_staff_assignments"."shift_end");