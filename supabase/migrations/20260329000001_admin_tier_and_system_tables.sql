-- Migration: Add admin_tier enum/column to user table + webhook_logs + cron_job_history tables
-- Idempotent: Safe to run multiple times

-- 1. Create admin_tier enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_tier') THEN
        CREATE TYPE "admin_tier" AS ENUM ('super_admin', 'support', 'billing_admin');
    END IF;
END $$;

-- 2. Add admin_tier column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "admin_tier" "admin_tier";

-- 3. Create webhook_logs table
CREATE TABLE IF NOT EXISTS "webhook_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'received',
    "response_code" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_webhook_logs_created" ON "webhook_logs" ("created_at" DESC);

-- 4. Create cron_job_history table
CREATE TABLE IF NOT EXISTS "cron_job_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "completed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cron_history_job_name" ON "cron_job_history" ("job_name", "started_at" DESC);
