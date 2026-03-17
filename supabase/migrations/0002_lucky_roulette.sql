CREATE TABLE IF NOT EXISTS "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"performed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_notes_tenant_id_tenants_id_fk') THEN
        ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_notes_customer_id_customers_id_fk') THEN
        ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_notes_created_by_user_id_fk') THEN
        ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_activities_tenant_id_tenants_id_fk') THEN
        ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_activities_customer_id_customers_id_fk') THEN
        ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_activities_performed_by_user_id_fk') THEN
        ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_tags_customer_id_customers_id_fk') THEN
        ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_tags_tag_id_tags_id_fk') THEN
        ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_tenant_id_tenants_id_fk') THEN
        ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_notes_tenant_customer" ON "customer_notes" USING btree ("tenant_id","customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_activities_tenant_customer" ON "customer_activities" USING btree ("tenant_id","customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_activities_created_at" ON "customer_activities" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_tags_customer_tag" ON "customer_tags" USING btree ("customer_id","tag_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tags_tenant_name" ON "tags" USING btree ("tenant_id","name");
