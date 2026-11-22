CREATE TABLE "public_rate_limits" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer NOT NULL,
	CONSTRAINT "public_rate_limits_scope_key_window_start_pk" PRIMARY KEY("scope","key","window_start")
);
--> statement-breakpoint
CREATE INDEX "public_rate_limits_window_start_idx" ON "public_rate_limits" USING btree ("window_start");