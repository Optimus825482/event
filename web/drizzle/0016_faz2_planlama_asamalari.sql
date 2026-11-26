CREATE TYPE "public"."planning_stage" AS ENUM('defined', 'layout_ready', 'staffing_ready', 'tables_classified', 'casino_allocated', 'priced', 'on_sale', 'sales_closed');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'planning_stage_advanced';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'planning_stage_reverted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'sales_opened';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'sales_closed';--> statement-breakpoint
CREATE TABLE "event_stage_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"from_stage" "planning_stage" NOT NULL,
	"to_stage" "planning_stage" NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "event_stage_transitions_kind_valid" CHECK ("event_stage_transitions"."kind" IN ('advance','revert','reopen'))
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "planning_stage" "planning_stage" DEFAULT 'defined' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "stage_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "artist_name" text;--> statement-breakpoint
ALTER TABLE "event_stage_transitions" ADD CONSTRAINT "event_stage_transitions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_stage_transitions" ADD CONSTRAINT "event_stage_transitions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_stage_transitions_event_created_idx" ON "event_stage_transitions" USING btree ("event_id","created_at");