-- Add archived_at column to 6 entity tables for soft-delete/archive support
-- NULL = active, non-NULL = archived (timestamp of when it was archived)

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NULL;

-- Partial indexes for fast filtering of non-archived records (most common query path)
CREATE INDEX IF NOT EXISTS "idx_customers_not_archived" ON "customers" ("tenant_id") WHERE "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_jobs_not_archived" ON "jobs" ("tenant_id") WHERE "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_invoices_not_archived" ON "invoices" ("tenant_id") WHERE "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_quotes_not_archived" ON "quotes" ("tenant_id") WHERE "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_bookings_not_archived" ON "bookings" ("tenant_id") WHERE "archived_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_equipment_not_archived" ON "equipment" ("tenant_id") WHERE "archived_at" IS NULL;
