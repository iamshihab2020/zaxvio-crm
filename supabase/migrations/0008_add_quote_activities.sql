-- Quote activity timeline table
CREATE TABLE IF NOT EXISTS "quote_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "quote_id" uuid NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "metadata" jsonb,
  "performed_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_quote_activities_tenant_quote" ON "quote_activities"("tenant_id", "quote_id");
CREATE INDEX IF NOT EXISTS "idx_quote_activities_created_at" ON "quote_activities"("created_at");
