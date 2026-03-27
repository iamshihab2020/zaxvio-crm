CREATE TABLE "job_pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"performed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_tax_rate" text DEFAULT '0';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "license_number" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "invoice_payment_terms" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "invoice_payment_instructions" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "invoice_terms_conditions" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "invoice_footer_message" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "quote_terms_conditions" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "quote_footer_message" text;--> statement-breakpoint
ALTER TABLE "job_pipeline_stages" ADD CONSTRAINT "job_pipeline_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_activities" ADD CONSTRAINT "quote_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_activities" ADD CONSTRAINT "quote_activities_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_activities" ADD CONSTRAINT "quote_activities_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pipeline_stages_tenant_name" ON "job_pipeline_stages" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_tenant_sort" ON "job_pipeline_stages" USING btree ("tenant_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_quote_activities_tenant_quote" ON "quote_activities" USING btree ("tenant_id","quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_activities_created_at" ON "quote_activities" USING btree ("created_at");