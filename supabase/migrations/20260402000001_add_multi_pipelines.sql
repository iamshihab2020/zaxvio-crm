-- ============================================================
-- Multi-Pipeline Migration
-- Adds pipelines table, links stages and jobs to pipelines.
-- Migrates existing stages/jobs into a "Default" pipeline per tenant.
-- ALL statements are idempotent.
-- ============================================================

-- 1. Create pipelines table
CREATE TABLE IF NOT EXISTS "pipelines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_pipelines_tenant_name"
  ON "pipelines" ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "idx_pipelines_tenant_id"
  ON "pipelines" ("tenant_id");

-- 2. Add pipeline_id to job_pipeline_stages (nullable initially for backfill)
ALTER TABLE "job_pipeline_stages"
  ADD COLUMN IF NOT EXISTS "pipeline_id" uuid REFERENCES "pipelines"("id") ON DELETE CASCADE;

-- 3. Add pipeline_id to jobs (nullable, stays nullable)
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "pipeline_id" uuid REFERENCES "pipelines"("id") ON DELETE SET NULL;

-- 4. Data migration: create a "Default" pipeline for each tenant that has stages
INSERT INTO "pipelines" ("id", "tenant_id", "name", "label", "is_default")
SELECT
  gen_random_uuid(),
  jps.tenant_id,
  'default',
  'Default',
  true
FROM "job_pipeline_stages" jps
GROUP BY jps.tenant_id
ON CONFLICT DO NOTHING;

-- 5. Backfill pipeline_id on existing stages
UPDATE "job_pipeline_stages" jps
SET "pipeline_id" = p.id
FROM "pipelines" p
WHERE p.tenant_id = jps.tenant_id
  AND p.name = 'default'
  AND jps.pipeline_id IS NULL;

-- 6. Backfill pipeline_id on existing jobs
UPDATE "jobs" j
SET "pipeline_id" = p.id
FROM "pipelines" p
WHERE p.tenant_id = j.tenant_id
  AND p.name = 'default'
  AND j.pipeline_id IS NULL;

-- 7. Make pipeline_id NOT NULL on stages (safe after backfill)
ALTER TABLE "job_pipeline_stages"
  ALTER COLUMN "pipeline_id" SET NOT NULL;

-- 8. Drop old unique index scoped to tenant, create new one scoped to pipeline
DROP INDEX IF EXISTS "idx_pipeline_stages_tenant_name";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pipeline_stages_pipeline_name"
  ON "job_pipeline_stages" ("pipeline_id", "name");

-- 9. Drop old sort index, create new one scoped to pipeline
DROP INDEX IF EXISTS "idx_pipeline_stages_tenant_sort";
CREATE INDEX IF NOT EXISTS "idx_pipeline_stages_pipeline_sort"
  ON "job_pipeline_stages" ("pipeline_id", "sort_order");

-- 10. Add tenant_id index on stages (for tenant-scoped lookups)
CREATE INDEX IF NOT EXISTS "idx_pipeline_stages_tenant_id"
  ON "job_pipeline_stages" ("tenant_id");

-- 11. Add composite index on jobs for pipeline+status Kanban queries
CREATE INDEX IF NOT EXISTS "idx_jobs_pipeline_status"
  ON "jobs" ("pipeline_id", "status");
