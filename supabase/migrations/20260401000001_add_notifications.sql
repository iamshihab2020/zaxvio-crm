-- Multi-channel notification system: notifications, reads, channel config, deliveries
-- All SQL is idempotent (safe to re-run)

-- === Enums ===

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE "notification_type" AS ENUM (
            'booking_received',
            'job_status_changed',
            'invoice_paid',
            'customer_created',
            'quote_accepted',
            'quote_declined',
            'invoice_overdue',
            'team_member_joined'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE "notification_channel" AS ENUM (
            'in_app',
            'email',
            'sms',
            'voice'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE "delivery_status" AS ENUM (
            'pending',
            'sent',
            'delivered',
            'failed'
        );
    END IF;
END $$;

-- === Table: notifications ===

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "type" "notification_type" NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "entity_type" text,
    "entity_id" uuid,
    "actor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
    "metadata" jsonb,
    "dedup_key" text,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_created"
    ON "notifications" ("tenant_id", "created_at" DESC);

-- Partial unique index for dedup (only where dedup_key is not null)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_dedup'
    ) THEN
        CREATE UNIQUE INDEX "idx_notifications_dedup"
            ON "notifications" ("tenant_id", "dedup_key")
            WHERE "dedup_key" IS NOT NULL;
    END IF;
END $$;

-- === Table: notification_reads ===

CREATE TABLE IF NOT EXISTS "notification_reads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "notification_id" uuid NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "read_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notification_reads_user_notification'
    ) THEN
        CREATE UNIQUE INDEX "idx_notification_reads_user_notification"
            ON "notification_reads" ("user_id", "notification_id");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_notification_reads_notification"
    ON "notification_reads" ("notification_id");

-- === Table: notification_channel_config ===

CREATE TABLE IF NOT EXISTS "notification_channel_config" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "notification_type" "notification_type" NOT NULL,
    "in_app" boolean NOT NULL DEFAULT true,
    "email" boolean NOT NULL DEFAULT true,
    "sms" boolean NOT NULL DEFAULT false,
    "voice" boolean NOT NULL DEFAULT false
);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notification_channel_config_unique'
    ) THEN
        CREATE UNIQUE INDEX "idx_notification_channel_config_unique"
            ON "notification_channel_config" ("tenant_id", "user_id", "notification_type");
    END IF;
END $$;

-- === Table: notification_deliveries ===

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "notification_id" uuid NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
    "channel" "notification_channel" NOT NULL,
    "recipient_id" text NOT NULL,
    "status" "delivery_status" NOT NULL,
    "error_message" text,
    "sent_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_notification_deliveries_notification_channel"
    ON "notification_deliveries" ("notification_id", "channel");

-- Note: 90-day retention cleanup can be added as a cron job later
-- DELETE FROM notifications WHERE created_at < now() - interval '90 days';
