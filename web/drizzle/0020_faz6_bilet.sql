CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pnr" text,
	"client_key" uuid NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"buyer_first_name" text,
	"buyer_last_name" text,
	"buyer_last_name_key" text,
	"buyer_email" text,
	"buyer_phone" text,
	"terms_accepted_at" timestamp with time zone,
	"payment_provider" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"eticket_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_pnr_uq" UNIQUE("pnr"),
	CONSTRAINT "orders_client_key_uq" UNIQUE("client_key"),
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" IN ('pending', 'paid', 'expired')),
	CONSTRAINT "orders_total_non_negative" CHECK ("orders"."total_amount" >= 0),
	CONSTRAINT "orders_paid_complete" CHECK ("orders"."status" <> 'paid' OR ("orders"."pnr" IS NOT NULL AND "orders"."paid_at" IS NOT NULL AND "orders"."buyer_last_name_key" IS NOT NULL AND "orders"."buyer_email" IS NOT NULL AND "orders"."terms_accepted_at" IS NOT NULL AND "orders"."payment_provider" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"outcome" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"provider_ref" text,
	"is_demo" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_outcome_valid" CHECK ("payment_attempts"."outcome" IN ('approved', 'declined', 'error'))
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"seat_slot_id" uuid,
	"status" text DEFAULT 'held' NOT NULL,
	"sale_category" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"qr_token" text,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" uuid,
	"check_in_gate" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_qr_token_uq" UNIQUE("qr_token"),
	CONSTRAINT "tickets_status_valid" CHECK ("tickets"."status" IN ('held', 'issued', 'expired')),
	CONSTRAINT "tickets_active_has_slot" CHECK (("tickets"."status" IN ('held', 'issued')) = ("tickets"."seat_slot_id" IS NOT NULL)),
	CONSTRAINT "tickets_issued_has_qr" CHECK ("tickets"."status" <> 'issued' OR "tickets"."qr_token" IS NOT NULL),
	CONSTRAINT "tickets_gate_range" CHECK ("tickets"."check_in_gate" BETWEEN 1 AND 9)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_table_fk" FOREIGN KEY ("event_id","table_id") REFERENCES "public"."event_tables"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seat_slot_fk" FOREIGN KEY ("table_id","seat_slot_id") REFERENCES "public"."table_seat_slots"("table_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_event_status_idx" ON "orders" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "orders_pending_expiry_idx" ON "orders" USING btree ("hold_expires_at") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_active_seat_uq" ON "tickets" USING btree ("seat_slot_id") WHERE status IN ('held', 'issued');--> statement-breakpoint
CREATE INDEX "tickets_order_id_idx" ON "tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "tickets_event_table_status_idx" ON "tickets" USING btree ("event_id","table_id","status");