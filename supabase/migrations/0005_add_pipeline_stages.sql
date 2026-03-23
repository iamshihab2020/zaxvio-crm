-- Pipeline stages table for custom Kanban columns
CREATE TABLE IF NOT EXISTS "job_pipeline_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "color" text NOT NULL DEFAULT 'gray',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Unique index: one stage name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pipeline_stages_tenant_name"
  ON "job_pipeline_stages" ("tenant_id", "name");

-- Sort order index
CREATE INDEX IF NOT EXISTS "idx_pipeline_stages_tenant_sort"
  ON "job_pipeline_stages" ("tenant_id", "sort_order");

-- Convert jobs.status from enum to text (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'status' AND udt_name = 'job_status'
  ) THEN
    ALTER TABLE "jobs" ALTER COLUMN "status" TYPE text USING "status"::text;
  END IF;
END $$;

-- Seed default pipeline stages for all existing tenants that don't have any yet
INSERT INTO "job_pipeline_stages" ("tenant_id", "name", "label", "color", "sort_order", "is_default")
SELECT t.id, s.name, s.label, s.color, s.sort_order, true
FROM "tenants" t
CROSS JOIN (VALUES
  ('scheduled',   'Scheduled',   'blue',   0),
  ('in_progress', 'In Progress', 'brand',  1),
  ('completed',   'Completed',   'green',  2),
  ('cancelled',   'Cancelled',   'gray',   3)
) AS s(name, label, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "job_pipeline_stages" ps
  WHERE ps.tenant_id = t.id AND ps.name = s.name
)
ON CONFLICT DO NOTHING;
