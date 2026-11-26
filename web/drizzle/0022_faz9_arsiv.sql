CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"genre" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_name_key_uq" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "event_archives" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone NOT NULL,
	"archived_by" uuid,
	"event_name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"event_type" text,
	"artist_id" uuid,
	"artist_name" text,
	"artist_fee" numeric(12, 2),
	"currency" char(3) DEFAULT 'TRY' NOT NULL,
	"table_count" integer DEFAULT 0 NOT NULL,
	"total_capacity" integer DEFAULT 0 NOT NULL,
	"casino_table_count" integer DEFAULT 0 NOT NULL,
	"casino_seat_count" integer DEFAULT 0 NOT NULL,
	"online_table_count" integer DEFAULT 0 NOT NULL,
	"sellable_seat_count" integer DEFAULT 0 NOT NULL,
	"tickets_sold" integer DEFAULT 0 NOT NULL,
	"demo_tickets_sold" integer DEFAULT 0 NOT NULL,
	"tickets_checked_in" integer DEFAULT 0 NOT NULL,
	"reservation_count" integer DEFAULT 0 NOT NULL,
	"reservations_checked_in" integer DEFAULT 0 NOT NULL,
	"reservations_no_show" integer DEFAULT 0 NOT NULL,
	"guests_expected" integer DEFAULT 0 NOT NULL,
	"guests_checked_in" integer DEFAULT 0 NOT NULL,
	"fnb_staff_count" integer DEFAULT 0 NOT NULL,
	"ticket_revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"demo_ticket_revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"estimated_expense" numeric(12, 2) DEFAULT '0' NOT NULL,
	"actual_expense" numeric(12, 2) DEFAULT '0' NOT NULL,
	"estimated_other_income" numeric(12, 2) DEFAULT '0' NOT NULL,
	"actual_other_income" numeric(12, 2) DEFAULT '0' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "artist_id" uuid;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_archives_starts_at_idx" ON "event_archives" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "event_archives_artist_id_idx" ON "event_archives" USING btree ("artist_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_artist_id_idx" ON "events" USING btree ("artist_id");