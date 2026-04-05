CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'sms', 'voice');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_received', 'job_status_changed', 'invoice_paid', 'customer_created', 'quote_accepted', 'quote_declined', 'invoice_overdue', 'team_member_joined');--> statement-breakpoint
CREATE TYPE "public"."photo_tag" AS ENUM('before', 'after', 'general');--> statement-breakpoint
CREATE TYPE "public"."service_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual');--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"customer_id" uuid,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channel_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"voice" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient_id" text NOT NULL,
	"status" "delivery_status" NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"actor_id" text,
	"metadata" jsonb,
	"dedup_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_pipeline_stages_tenant_name";--> statement-breakpoint
DROP INDEX "idx_pipeline_stages_tenant_sort";--> statement-breakpoint
ALTER TABLE "refrigerant_logs" ALTER COLUMN "job_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trial_expiry_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_impersonation_sessions" ADD COLUMN "mode" text DEFAULT 'ghost' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_impersonation_sessions" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_impersonation_sessions" ADD COLUMN "admin_name" text;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD COLUMN "frequency" "service_frequency" DEFAULT 'annual';--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD COLUMN "renewal_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source" text DEFAULT 'portal' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_photos" ADD COLUMN "tag" "photo_tag" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_photos" ADD COLUMN "uploaded_by" text;--> statement-breakpoint
ALTER TABLE "job_photos" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "equipment_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "pipeline_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "last_overdue_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "equipment_id" uuid;--> statement-breakpoint
ALTER TABLE "job_pipeline_stages" ADD COLUMN "pipeline_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel_config" ADD CONSTRAINT "notification_channel_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel_config" ADD CONSTRAINT "notification_channel_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_job_documents_job_id" ON "job_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_tenant_id" ON "job_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pipelines_tenant_name" ON "pipelines" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_pipelines_tenant_id" ON "pipelines" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_channel_config_unique" ON "notification_channel_config" USING btree ("tenant_id","user_id","notification_type");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_notification_channel" ON "notification_deliveries" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_reads_user_notification" ON "notification_reads" USING btree ("user_id","notification_id");--> statement-breakpoint
CREATE INDEX "idx_notification_reads_notification" ON "notification_reads" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_tenant_created" ON "notifications" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notifications_dedup" ON "notifications" USING btree ("tenant_id","dedup_key") WHERE "notifications"."dedup_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "refrigerant_logs" ADD CONSTRAINT "refrigerant_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_pipeline_stages" ADD CONSTRAINT "job_pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_maintenance_contracts_tenant_customer" ON "maintenance_contracts" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_maintenance_contracts_end_date" ON "maintenance_contracts" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "idx_jobs_pipeline_status" ON "jobs" USING btree ("pipeline_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pipeline_stages_pipeline_name" ON "job_pipeline_stages" USING btree ("pipeline_id","name");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_pipeline_sort" ON "job_pipeline_stages" USING btree ("pipeline_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_tenant_id" ON "job_pipeline_stages" USING btree ("tenant_id");