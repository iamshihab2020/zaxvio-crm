-- Add equipment_id FK to quotes table (mirrors jobs.equipment_id)
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "equipment_id" UUID REFERENCES "equipment"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_quotes_equipment_id" ON "quotes"("equipment_id");
