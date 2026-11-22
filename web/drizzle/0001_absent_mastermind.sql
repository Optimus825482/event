CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."guest_note_type" AS ENUM('pre_event', 'during_event', 'post_event', 'general');--> statement-breakpoint
CREATE TYPE "public"."permission_module" AS ENUM('events', 'reservations', 'check_in', 'staff', 'customers', 'venues', 'settings', 'users', 'invitations', 'notifications');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('active', 'inactive', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."check_in_outcome" AS ENUM('checked_in', 'already_checked_in', 'not_found', 'invalid_status');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'checked_in', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('table', 'special_task', 'service_point');--> statement-breakpoint
CREATE TYPE "public"."performance_rating" AS ENUM('very_bad', 'bad', 'average', 'good', 'successful', 'excellent');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."notification_target_role" AS ENUM('all', 'admin', 'leader', 'staff');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('event_created', 'event_updated', 'event_cancelled', 'venue_layout_completed', 'team_organization_completed', 'review_system_activated', 'review_system_deactivated', 'staff_review_completed', 'staff_review_updated', 'reservation_system_activated', 'reservation_system_deactivated', 'team_assignment_changed', 'staff_added_to_team', 'staff_removed_from_team', 'table_group_changed', 'new_staff_added', 'system_announcement');--> statement-breakpoint
CREATE TABLE "department_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"work_location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_locations_department_location_uq" UNIQUE("department_id","work_location_id")
);
--> statement-breakpoint
CREATE TABLE "department_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_positions_department_position_uq" UNIQUE("department_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"badge_color" text DEFAULT 'bg-blue-500/20 text-blue-400 border-blue-500/30' NOT NULL,
	"bg_color" text DEFAULT 'bg-blue-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "table_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"icon" text,
	"base_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'TRY' NOT NULL,
	"shape" text DEFAULT 'round' NOT NULL,
	"capacity" integer DEFAULT 8 NOT NULL,
	"min_spacing" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_types_capacity_positive" CHECK ("table_types"."capacity" > 0),
	CONSTRAINT "table_types_base_price_non_negative" CHECK ("table_types"."base_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"address" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tags_customer_tag_uq" UNIQUE("customer_id","tag")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"phone_normalized" text,
	"email" text,
	"email_normalized" text,
	"vip_score" integer DEFAULT 0 NOT NULL,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	"notes" text,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'TRY' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"total_attended_events" integer DEFAULT 0 NOT NULL,
	"total_reservations" integer DEFAULT 0 NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"last_event_at" timestamp with time zone,
	"last_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_total_spent_non_negative" CHECK ("customers"."total_spent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "guest_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"event_id" uuid,
	"reservation_id" uuid,
	"content" text NOT NULL,
	"note_type" "guest_note_type" DEFAULT 'general' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sicil_no" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"photo_path" text,
	"department_id" uuid,
	"position_id" uuid,
	"work_location_id" uuid,
	"mentor" text,
	"color" text,
	"gender" "gender",
	"birth_date" date,
	"blood_type" text,
	"shoe_size" integer,
	"sock_size" text,
	"hire_date" date,
	"termination_date" date,
	"termination_reason" text,
	"years_at_company" integer,
	"status" "staff_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_sicil_no_unique" UNIQUE("sicil_no")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module" "permission_module" NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_module_uq" UNIQUE("user_id","module")
);
--> statement-breakpoint
CREATE TABLE "event_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"table_type_id" uuid,
	"capacity" integer NOT NULL,
	"x" double precision DEFAULT 0 NOT NULL,
	"y" double precision DEFAULT 0 NOT NULL,
	"rotation" double precision DEFAULT 0 NOT NULL,
	"is_loca" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_tables_event_label_uq" UNIQUE("event_id","label"),
	CONSTRAINT "event_tables_event_id_id_uq" UNIQUE("event_id","id"),
	CONSTRAINT "event_tables_capacity_positive" CHECK ("event_tables"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"layout_decor" jsonb,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"event_type" text,
	"cover_image" text,
	"total_capacity" integer DEFAULT 0 NOT NULL,
	"organizer_id" uuid NOT NULL,
	"venue_template_id" uuid,
	"review_enabled" boolean DEFAULT false NOT NULL,
	"review_history_visible" boolean DEFAULT false NOT NULL,
	"reservation_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_ends_after_starts" CHECK ("events"."ends_at" IS NULL OR "events"."ends_at" > "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "service_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"point_type" text DEFAULT 'bar' NOT NULL,
	"required_staff_count" integer DEFAULT 1 NOT NULL,
	"allowed_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"x" double precision DEFAULT 0 NOT NULL,
	"y" double precision DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#06b6d4' NOT NULL,
	"shape" text DEFAULT 'square' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_points_event_id_id_uq" UNIQUE("event_id","id"),
	CONSTRAINT "service_points_required_staff_non_negative" CHECK ("service_points"."required_staff_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "venue_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"layout_data" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"thumbnail" text,
	"created_by_id" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_shifts_event_name_uq" UNIQUE NULLS NOT DISTINCT("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "check_in_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"idempotency_key" text NOT NULL,
	"client_timestamp" timestamp with time zone,
	"actor_id" uuid,
	"outcome" "check_in_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"guest_count" integer NOT NULL,
	"guest_name" text,
	"guest_phone" text,
	"guest_email" text,
	"special_requests" text,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"qr_token" text NOT NULL,
	"legacy_qr_hash" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'TRY' NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "reservations_legacy_qr_hash_unique" UNIQUE("legacy_qr_hash"),
	CONSTRAINT "reservations_guest_count_range" CHECK ("reservations"."guest_count" BETWEEN 1 AND 50),
	CONSTRAINT "reservations_total_amount_non_negative" CHECK ("reservations"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assignment_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_tables_assignment_table_uq" UNIQUE("assignment_id","table_id")
);
--> statement-breakpoint
CREATE TABLE "event_extra_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"position" text,
	"role" text,
	"shift_start" time,
	"shift_end" time,
	"color" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_extra_staff_event_id_id_uq" UNIQUE("event_id","id")
);
--> statement-breakpoint
CREATE TABLE "event_extra_staff_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"extra_staff_id" uuid NOT NULL,
	"table_group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_extra_staff_groups_staff_group_uq" UNIQUE("extra_staff_id","table_group_id")
);
--> statement-breakpoint
CREATE TABLE "event_extra_staff_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"extra_staff_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_extra_staff_tables_staff_table_uq" UNIQUE("extra_staff_id","table_id")
);
--> statement-breakpoint
CREATE TABLE "event_staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_id" uuid,
	"team_id" uuid,
	"assignment_type" "assignment_type" DEFAULT 'table' NOT NULL,
	"service_point_id" uuid,
	"role" text,
	"shift_start" time,
	"shift_end" time,
	"special_task_location" text,
	"special_task_start_time" time,
	"special_task_end_time" time,
	"color" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_staff_assignments_event_staff_shift_uq" UNIQUE NULLS NOT DISTINCT("event_id","staff_id","shift_id"),
	CONSTRAINT "event_staff_assignments_event_id_id_uq" UNIQUE("event_id","id"),
	CONSTRAINT "event_staff_assignments_service_point_matches_type" CHECK (("event_staff_assignments"."assignment_type" = 'service_point') = ("event_staff_assignments"."service_point_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "organization_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by_id" uuid,
	"staff_assignments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"team_assignments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"table_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_group_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"table_group_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_group_tables_event_table_uq" UNIQUE("event_id","table_id")
);
--> statement-breakpoint
CREATE TABLE "table_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"team_id" uuid,
	"supervisor_staff_id" uuid,
	"group_type" text DEFAULT 'standard' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_groups_event_id_id_uq" UNIQUE("event_id","id")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"is_leader" boolean DEFAULT false NOT NULL,
	"role" text,
	"shift_start" time,
	"shift_end" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_staff_uq" UNIQUE("team_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"leader_staff_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"template_id" uuid,
	"custom_elements" jsonb,
	"size" text DEFAULT 'A5' NOT NULL,
	"width" integer DEFAULT 559 NOT NULL,
	"height" integer DEFAULT 794 NOT NULL,
	"background_color" text,
	"background_image" text,
	"background_gradient" text,
	"event_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"company_logo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system_template" boolean DEFAULT false NOT NULL,
	"size" text DEFAULT 'A5' NOT NULL,
	"width" integer DEFAULT 559 NOT NULL,
	"height" integer DEFAULT 794 NOT NULL,
	"background_color" text,
	"background_image" text,
	"background_gradient" text,
	"elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" uuid,
	"thumbnail_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_performance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"rating" "performance_rating" NOT NULL,
	"communication" smallint,
	"punctuality" smallint,
	"teamwork" smallint,
	"customer_service" smallint,
	"technical_skills" smallint,
	"initiative" smallint,
	"appearance" smallint,
	"stress_management" smallint,
	"strengths" text[] DEFAULT '{}'::text[] NOT NULL,
	"improvements" text[] DEFAULT '{}'::text[] NOT NULL,
	"recommended_trainings" text[] DEFAULT '{}'::text[] NOT NULL,
	"comment" text,
	"private_notes" text,
	"next_event_notes" text,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_performance_reviews_staff_event_reviewer_uq" UNIQUE("staff_id","event_id","reviewer_id"),
	CONSTRAINT "staff_performance_reviews_score_range" CHECK ("staff_performance_reviews"."score" BETWEEN 0 AND 100),
	CONSTRAINT "staff_performance_reviews_communication_range" CHECK ("staff_performance_reviews"."communication" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_punctuality_range" CHECK ("staff_performance_reviews"."punctuality" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_teamwork_range" CHECK ("staff_performance_reviews"."teamwork" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_customer_service_range" CHECK ("staff_performance_reviews"."customer_service" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_technical_skills_range" CHECK ("staff_performance_reviews"."technical_skills" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_initiative_range" CHECK ("staff_performance_reviews"."initiative" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_appearance_range" CHECK ("staff_performance_reviews"."appearance" BETWEEN 0 AND 5),
	CONSTRAINT "staff_performance_reviews_stress_management_range" CHECK ("staff_performance_reviews"."stress_management" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reads_notification_user_uq" UNIQUE("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"target_role" "notification_target_role" DEFAULT 'all' NOT NULL,
	"event_id" uuid,
	"created_by_id" uuid,
	"metadata" jsonb,
	"action_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text DEFAULT 'EventFlow' NOT NULL,
	"logo" text,
	"timezone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"language" text DEFAULT 'tr' NOT NULL,
	"default_grid_size" integer DEFAULT 20 NOT NULL,
	"snap_to_grid" boolean DEFAULT true NOT NULL,
	"show_grid_by_default" boolean DEFAULT true NOT NULL,
	"default_guest_count" integer DEFAULT 2 NOT NULL,
	"allow_overbooking" boolean DEFAULT false NOT NULL,
	"require_phone_number" boolean DEFAULT true NOT NULL,
	"require_email" boolean DEFAULT false NOT NULL,
	"auto_check_in_enabled" boolean DEFAULT false NOT NULL,
	"check_in_sound_enabled" boolean DEFAULT true NOT NULL,
	"show_table_directions" boolean DEFAULT true NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"sms_notifications" boolean DEFAULT false NOT NULL,
	"qr_code_system_enabled" boolean DEFAULT true NOT NULL,
	"invitation_system_enabled" boolean DEFAULT true NOT NULL,
	"smtp_host" text,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_user" text,
	"smtp_password_encrypted" text,
	"smtp_from_email" text,
	"smtp_from_name" text,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_locations" ADD CONSTRAINT "department_locations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_locations" ADD CONSTRAINT "department_locations_work_location_id_work_locations_id_fk" FOREIGN KEY ("work_location_id") REFERENCES "public"."work_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_positions" ADD CONSTRAINT "department_positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_positions" ADD CONSTRAINT "department_positions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_last_event_id_events_id_fk" FOREIGN KEY ("last_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_notes" ADD CONSTRAINT "guest_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_notes" ADD CONSTRAINT "guest_notes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_notes" ADD CONSTRAINT "guest_notes_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_notes" ADD CONSTRAINT "guest_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_work_location_id_work_locations_id_fk" FOREIGN KEY ("work_location_id") REFERENCES "public"."work_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_table_type_id_table_types_id_fk" FOREIGN KEY ("table_type_id") REFERENCES "public"."table_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_template_id_venue_templates_id_fk" FOREIGN KEY ("venue_template_id") REFERENCES "public"."venue_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_templates" ADD CONSTRAINT "venue_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_events" ADD CONSTRAINT "check_in_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_events" ADD CONSTRAINT "check_in_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_event_table_fk" FOREIGN KEY ("event_id","table_id") REFERENCES "public"."event_tables"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_tables" ADD CONSTRAINT "assignment_tables_assignment_fk" FOREIGN KEY ("event_id","assignment_id") REFERENCES "public"."event_staff_assignments"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_tables" ADD CONSTRAINT "assignment_tables_table_fk" FOREIGN KEY ("event_id","table_id") REFERENCES "public"."event_tables"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extra_staff" ADD CONSTRAINT "event_extra_staff_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extra_staff_groups" ADD CONSTRAINT "event_extra_staff_groups_extra_staff_fk" FOREIGN KEY ("event_id","extra_staff_id") REFERENCES "public"."event_extra_staff"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extra_staff_groups" ADD CONSTRAINT "event_extra_staff_groups_group_fk" FOREIGN KEY ("event_id","table_group_id") REFERENCES "public"."table_groups"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extra_staff_tables" ADD CONSTRAINT "event_extra_staff_tables_extra_staff_fk" FOREIGN KEY ("event_id","extra_staff_id") REFERENCES "public"."event_extra_staff"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_extra_staff_tables" ADD CONSTRAINT "event_extra_staff_tables_table_fk" FOREIGN KEY ("event_id","table_id") REFERENCES "public"."event_tables"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_shift_id_work_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."work_shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_service_point_fk" FOREIGN KEY ("event_id","service_point_id") REFERENCES "public"."service_points"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_group_tables" ADD CONSTRAINT "table_group_tables_group_fk" FOREIGN KEY ("event_id","table_group_id") REFERENCES "public"."table_groups"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_group_tables" ADD CONSTRAINT "table_group_tables_table_fk" FOREIGN KEY ("event_id","table_id") REFERENCES "public"."event_tables"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_groups" ADD CONSTRAINT "table_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_groups" ADD CONSTRAINT "table_groups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_groups" ADD CONSTRAINT "table_groups_supervisor_staff_id_staff_id_fk" FOREIGN KEY ("supervisor_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_staff_id_staff_id_fk" FOREIGN KEY ("leader_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_template_id_invitation_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invitation_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_templates" ADD CONSTRAINT "invitation_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_performance_reviews" ADD CONSTRAINT "staff_performance_reviews_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_locations_work_location_id_idx" ON "department_locations" USING btree ("work_location_id");--> statement-breakpoint
CREATE INDEX "department_positions_position_id_idx" ON "department_positions" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "departments_is_active_idx" ON "departments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "positions_is_active_idx" ON "positions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "work_locations_is_active_idx" ON "work_locations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "customer_tags_tag_idx" ON "customer_tags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_normalized_uq" ON "customers" USING btree ("phone_normalized") WHERE "customers"."phone_normalized" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_normalized_uq" ON "customers" USING btree ("email_normalized") WHERE "customers"."email_normalized" is not null;--> statement-breakpoint
CREATE INDEX "customers_full_name_idx" ON "customers" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "customers_last_event_id_idx" ON "customers" USING btree ("last_event_id");--> statement-breakpoint
CREATE INDEX "guest_notes_customer_id_idx" ON "guest_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "guest_notes_event_id_idx" ON "guest_notes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "guest_notes_reservation_id_idx" ON "guest_notes" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "guest_notes_created_by_id_idx" ON "guest_notes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "staff_department_id_idx" ON "staff" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "staff_position_id_idx" ON "staff" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "staff_work_location_id_idx" ON "staff" USING btree ("work_location_id");--> statement-breakpoint
CREATE INDEX "staff_status_idx" ON "staff" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_tables_table_type_id_idx" ON "event_tables" USING btree ("table_type_id");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events" USING btree ("organizer_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_status_starts_at_idx" ON "events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "events_venue_template_id_idx" ON "events" USING btree ("venue_template_id");--> statement-breakpoint
CREATE INDEX "venue_templates_created_by_id_idx" ON "venue_templates" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "check_in_events_reservation_id_idx" ON "check_in_events" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "check_in_events_actor_id_idx" ON "check_in_events" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_active_table_uq" ON "reservations" USING btree ("event_id","table_id") WHERE status IN ('pending', 'confirmed', 'checked_in');--> statement-breakpoint
CREATE INDEX "reservations_event_table_idx" ON "reservations" USING btree ("event_id","table_id");--> statement-breakpoint
CREATE INDEX "reservations_event_status_idx" ON "reservations" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "reservations_customer_id_idx" ON "reservations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reservations_checked_in_by_idx" ON "reservations" USING btree ("checked_in_by");--> statement-breakpoint
CREATE INDEX "assignment_tables_assignment_idx" ON "assignment_tables" USING btree ("event_id","assignment_id");--> statement-breakpoint
CREATE INDEX "assignment_tables_table_idx" ON "assignment_tables" USING btree ("event_id","table_id");--> statement-breakpoint
CREATE INDEX "event_extra_staff_groups_extra_staff_idx" ON "event_extra_staff_groups" USING btree ("event_id","extra_staff_id");--> statement-breakpoint
CREATE INDEX "event_extra_staff_groups_group_idx" ON "event_extra_staff_groups" USING btree ("event_id","table_group_id");--> statement-breakpoint
CREATE INDEX "event_extra_staff_tables_extra_staff_idx" ON "event_extra_staff_tables" USING btree ("event_id","extra_staff_id");--> statement-breakpoint
CREATE INDEX "event_extra_staff_tables_table_idx" ON "event_extra_staff_tables" USING btree ("event_id","table_id");--> statement-breakpoint
CREATE INDEX "event_staff_assignments_staff_id_idx" ON "event_staff_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "event_staff_assignments_shift_id_idx" ON "event_staff_assignments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "event_staff_assignments_team_id_idx" ON "event_staff_assignments" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "event_staff_assignments_service_point_idx" ON "event_staff_assignments" USING btree ("event_id","service_point_id");--> statement-breakpoint
CREATE INDEX "organization_templates_created_by_id_idx" ON "organization_templates" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "table_group_tables_group_idx" ON "table_group_tables" USING btree ("event_id","table_group_id");--> statement-breakpoint
CREATE INDEX "table_groups_event_sort_idx" ON "table_groups" USING btree ("event_id","sort_order");--> statement-breakpoint
CREATE INDEX "table_groups_team_id_idx" ON "table_groups" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "table_groups_supervisor_staff_id_idx" ON "table_groups" USING btree ("supervisor_staff_id");--> statement-breakpoint
CREATE INDEX "team_members_staff_id_idx" ON "team_members" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "teams_event_id_idx" ON "teams" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "teams_leader_staff_id_idx" ON "teams" USING btree ("leader_staff_id");--> statement-breakpoint
CREATE INDEX "event_invitations_event_id_idx" ON "event_invitations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_invitations_template_id_idx" ON "event_invitations" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "invitation_templates_created_by_id_idx" ON "invitation_templates" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "staff_performance_reviews_event_id_idx" ON "staff_performance_reviews" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "staff_performance_reviews_reviewer_id_idx" ON "staff_performance_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "notification_reads_user_read_at_idx" ON "notification_reads" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_target_role_created_at_idx" ON "notifications" USING btree ("target_role","created_at");--> statement-breakpoint
CREATE INDEX "notifications_type_created_at_idx" ON "notifications" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "notifications_event_id_idx" ON "notifications" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "notifications_created_by_id_idx" ON "notifications" USING btree ("created_by_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_id_unique" UNIQUE("staff_id");