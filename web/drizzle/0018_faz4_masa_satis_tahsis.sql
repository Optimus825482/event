-- Elle düzeltme: drizzle-kit "event_tables_event_id_id_allocation_uq" tekil kısıtını, ona dayanan iki bileşik
-- yabancı anahtardan (table_seat_slots_online_table_fk, reservations_casino_table_fk) sonra üretiyor; PostgreSQL
-- hedefte tekil kısıt yokken FK yaratamaz (42830). Yalnızca ifadelerin sırası değiştirildi, içerik aynı.
ALTER TYPE "public"."permission_module" ADD VALUE 'ticketing';--> statement-breakpoint
ALTER TYPE "public"."permission_module" ADD VALUE 'finance';--> statement-breakpoint
ALTER TYPE "public"."permission_module" ADD VALUE 'archive';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'casino_tables_released';--> statement-breakpoint
CREATE TABLE "event_sale_settings" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"shared_tables" boolean DEFAULT true NOT NULL,
	"block_single_leftover" boolean DEFAULT true NOT NULL,
	"loca_online" boolean DEFAULT false NOT NULL,
	"hold_minutes" integer DEFAULT 10 NOT NULL,
	"max_seats_per_order" integer DEFAULT 12 NOT NULL,
	"sale_starts_at" timestamp with time zone,
	"sale_ends_at" timestamp with time zone,
	"currency" char(3) DEFAULT 'TRY' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_sale_settings_hold_minutes_range" CHECK ("event_sale_settings"."hold_minutes" BETWEEN 5 AND 30),
	CONSTRAINT "event_sale_settings_max_seats_range" CHECK ("event_sale_settings"."max_seats_per_order" BETWEEN 1 AND 50),
	CONSTRAINT "event_sale_settings_window_valid" CHECK ("event_sale_settings"."sale_ends_at" IS NULL OR "event_sale_settings"."sale_starts_at" IS NULL OR "event_sale_settings"."sale_ends_at" > "event_sale_settings"."sale_starts_at")
);
--> statement-breakpoint
CREATE TABLE "event_seat_prices" (
	"event_id" uuid NOT NULL,
	"category" text NOT NULL,
	"final_price" numeric(12, 2),
	"recommended_price" numeric(12, 2),
	"coefficient" numeric(6, 3) DEFAULT '1' NOT NULL,
	"final_set_by" uuid,
	"final_set_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_seat_prices_event_id_category_pk" PRIMARY KEY("event_id","category"),
	CONSTRAINT "event_seat_prices_category_valid" CHECK ("event_seat_prices"."category" IN ('standard', 'premium', 'vip')),
	CONSTRAINT "event_seat_prices_final_positive" CHECK ("event_seat_prices"."final_price" IS NULL OR "event_seat_prices"."final_price" > 0),
	CONSTRAINT "event_seat_prices_recommended_non_negative" CHECK ("event_seat_prices"."recommended_price" IS NULL OR "event_seat_prices"."recommended_price" >= 0),
	CONSTRAINT "event_seat_prices_coefficient_positive" CHECK ("event_seat_prices"."coefficient" > 0)
);
--> statement-breakpoint
CREATE TABLE "table_seat_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"allocation" text DEFAULT 'online' NOT NULL,
	"seat_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_seat_slots_table_seat_uq" UNIQUE("table_id","seat_no"),
	CONSTRAINT "table_seat_slots_table_id_id_uq" UNIQUE("table_id","id"),
	CONSTRAINT "table_seat_slots_allocation_online" CHECK ("table_seat_slots"."allocation" = 'online'),
	CONSTRAINT "table_seat_slots_seat_no_positive" CHECK ("table_seat_slots"."seat_no" >= 1)
);
--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "sale_category" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "sellable_seats" integer;--> statement-breakpoint
ALTER TABLE "event_tables" ADD COLUMN "allocation" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "booking_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "allocation_lock" text GENERATED ALWAYS AS (CASE WHEN status IN ('pending', 'confirmed', 'checked_in') THEN 'casino' END) STORED;--> statement-breakpoint
ALTER TABLE "event_sale_settings" ADD CONSTRAINT "event_sale_settings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sale_settings" ADD CONSTRAINT "event_sale_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seat_prices" ADD CONSTRAINT "event_seat_prices_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seat_prices" ADD CONSTRAINT "event_seat_prices_final_set_by_users_id_fk" FOREIGN KEY ("final_set_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_event_id_id_allocation_uq" UNIQUE("event_id","id","allocation");--> statement-breakpoint
ALTER TABLE "table_seat_slots" ADD CONSTRAINT "table_seat_slots_online_table_fk" FOREIGN KEY ("event_id","table_id","allocation") REFERENCES "public"."event_tables"("event_id","id","allocation") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "table_seat_slots_event_table_idx" ON "table_seat_slots" USING btree ("event_id","table_id");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_casino_table_fk" FOREIGN KEY ("event_id","table_id","allocation_lock") REFERENCES "public"."event_tables"("event_id","id","allocation") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_booking_code_uq" UNIQUE("booking_code");--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_sale_category_valid" CHECK ("event_tables"."sale_category" IN ('standard', 'premium', 'vip'));--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_sellable_within_capacity" CHECK ("event_tables"."sellable_seats" IS NULL OR ("event_tables"."sellable_seats" >= 1 AND "event_tables"."sellable_seats" <= "event_tables"."capacity"));--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_allocation_valid" CHECK ("event_tables"."allocation" IN ('pending', 'casino', 'online', 'closed'));