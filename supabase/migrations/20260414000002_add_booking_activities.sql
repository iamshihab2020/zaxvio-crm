-- Create booking_activities table for audit trail on booking status changes (DF-BK-21)
CREATE TABLE IF NOT EXISTS "booking_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "metadata" jsonb,
  "performed_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_booking_activities_tenant_booking"
  ON "booking_activities" ("tenant_id", "booking_id");
CREATE INDEX IF NOT EXISTS "idx_booking_activities_created_at"
  ON "booking_activities" ("created_at");
