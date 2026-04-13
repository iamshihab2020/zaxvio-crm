-- Add unique index on (tenant_id, day_of_week) for availability_schedules
-- Prevents duplicate day entries from concurrent lazy-seeding (DF-BK-11)
CREATE UNIQUE INDEX IF NOT EXISTS "availability_schedules_tenant_day_unique"
  ON "availability_schedules" ("tenant_id", "day_of_week");
