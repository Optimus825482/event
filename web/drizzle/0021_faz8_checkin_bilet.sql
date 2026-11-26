ALTER TABLE "check_in_events" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "check_in_events" ADD COLUMN "gate" smallint;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "check_in_gate" smallint;--> statement-breakpoint
ALTER TABLE "check_in_events" ADD CONSTRAINT "check_in_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_in_events_ticket_id_idx" ON "check_in_events" USING btree ("ticket_id");--> statement-breakpoint
ALTER TABLE "check_in_events" ADD CONSTRAINT "check_in_events_gate_range" CHECK ("check_in_events"."gate" BETWEEN 1 AND 9);--> statement-breakpoint
ALTER TABLE "check_in_events" ADD CONSTRAINT "check_in_events_single_target" CHECK ("check_in_events"."reservation_id" IS NULL OR "check_in_events"."ticket_id" IS NULL);--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_gate_range" CHECK ("reservations"."check_in_gate" BETWEEN 1 AND 9);