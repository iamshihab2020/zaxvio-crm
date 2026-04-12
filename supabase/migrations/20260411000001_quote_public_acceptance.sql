-- Quote Public Acceptance: token-based online acceptance, scheduling, and tenant settings
-- All statements are idempotent (safe to re-run)

-- 1. Access token on quotes (generated at send-time, used for public URL)
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "access_token" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_quotes_access_token"
  ON "quotes" ("access_token") WHERE "access_token" IS NOT NULL;

-- 2. Decline reason (optional text from customer when declining online)
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "decline_reason" TEXT;

-- 3. Customer-chosen schedule after acceptance
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_scheduled_date" DATE;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customer_scheduled_time" TEXT;

-- 4. Tenant settings for online quote acceptance
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "quote_online_acceptance_enabled" BOOLEAN DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "quote_post_acceptance_scheduling" BOOLEAN DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "quote_auto_convert_to_job" BOOLEAN DEFAULT false;
