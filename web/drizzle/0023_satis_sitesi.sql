CREATE TABLE "event_site_content" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"hero_image" text,
	"summary" text,
	"doors_open_at" timestamp with time zone,
	"age_limit" text,
	"dress_code" text,
	"sightline_set" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_sale_settings" ADD COLUMN "sale_mode" text DEFAULT 'seat' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "sales_demo_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_site_content" ADD CONSTRAINT "event_site_content_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sale_settings" ADD CONSTRAINT "event_sale_settings_sale_mode_valid" CHECK ("event_sale_settings"."sale_mode" IN ('table', 'seat'));