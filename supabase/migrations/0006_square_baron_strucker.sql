CREATE TYPE "public"."admin_tier" AS ENUM('super_admin', 'support', 'billing_admin');--> statement-breakpoint
CREATE TABLE "cron_job_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'received' NOT NULL,
	"response_code" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "admin_tier" "admin_tier";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cron_history_job_name" ON "cron_job_history" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_created" ON "webhook_logs" USING btree ("created_at");