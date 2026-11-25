CREATE TYPE "public"."app_department" AS ENUM('entertainment', 'fnb', 'casino');--> statement-breakpoint
CREATE TYPE "public"."department_level" AS ENUM('manager', 'assistant', 'member');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'user';--> statement-breakpoint
CREATE TABLE "department_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"department" "app_department" NOT NULL,
	"level" "department_level" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_memberships_user_department_unique" UNIQUE("user_id","department")
);
--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;