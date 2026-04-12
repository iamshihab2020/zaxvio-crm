-- Add quote_id FK to bookings so quote → booking → job chain is preserved
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "quote_id" UUID REFERENCES "quotes"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_bookings_quote_id" ON "bookings"("quote_id");
