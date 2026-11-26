CREATE TABLE "event_finance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"estimated_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"actual_amount" numeric(12, 2),
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_finance_items_direction_valid" CHECK ("event_finance_items"."direction" IN ('expense', 'income')),
	CONSTRAINT "event_finance_items_category_valid" CHECK ("event_finance_items"."category" IN ('artist_fee', 'production', 'fnb', 'staff', 'marketing', 'sponsorship', 'other')),
	CONSTRAINT "event_finance_items_amounts_non_negative" CHECK ("event_finance_items"."estimated_amount" >= 0 AND ("event_finance_items"."actual_amount" IS NULL OR "event_finance_items"."actual_amount" >= 0))
);
--> statement-breakpoint
CREATE TABLE "event_finance_plans" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"target_profit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"casino_cost_mode" text DEFAULT 'free' NOT NULL,
	"casino_transfer_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"recommended_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_finance_plans_target_non_negative" CHECK ("event_finance_plans"."target_profit" >= 0),
	CONSTRAINT "event_finance_plans_casino_mode_valid" CHECK ("event_finance_plans"."casino_cost_mode" IN ('free', 'transfer')),
	CONSTRAINT "event_finance_plans_transfer_price_non_negative" CHECK ("event_finance_plans"."casino_transfer_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_finance_items" ADD CONSTRAINT "event_finance_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_finance_items" ADD CONSTRAINT "event_finance_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_finance_plans" ADD CONSTRAINT "event_finance_plans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_finance_plans" ADD CONSTRAINT "event_finance_plans_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_finance_items_event_sort_idx" ON "event_finance_items" USING btree ("event_id","sort_order");