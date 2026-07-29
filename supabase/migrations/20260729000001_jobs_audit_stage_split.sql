-- Jobs audit remediation — the §5.1 "full split" (JOB-01, 02, 03, 06, 28, 27)
--
-- JOB-01: `jobs.status` is a plain `text` column because a pipeline stage's
--         *name* is the status. But `updateJobStatusBody`, `reorderBody` and
--         `bulkJobStatusBody` all hardcode the four canonical values, so a
--         custom stage created through the UI could never receive a job — the
--         drag 400s at Zod before the handler runs.
--
--         The fix is to stop overloading one column with two jobs. A stage now
--         declares which *lifecycle* it belongs to; `jobs.stage_id` is the real
--         pointer; `jobs.status` stays as the stage name for compatibility with
--         every existing query but is only ever written from a validated stage.
--
-- JOB-28: the stage jobCount subquery joins on `status = name` with no
--         `archived_at` filter. Joining on `stage_id` makes that subquery
--         cheap and correct in one move.
--
-- JOB-27: `calendar_events.job_id` and `job_documents.customer_id` were bare
--         uuid columns with no foreign key, so deleting a job or a customer
--         left them pointing at nothing.
--
-- Idempotent per strict-rules §1.

-- ── JOB-01: stage lifecycle ─────────────────────────────────────────────────
-- Which of the four real statuses a stage represents. Defaults to 'scheduled'
-- so a newly created custom stage is a valid starting point rather than a
-- dead end.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_pipeline_stages' AND column_name = 'lifecycle'
  ) THEN
    ALTER TABLE job_pipeline_stages
      ADD COLUMN lifecycle job_status NOT NULL DEFAULT 'scheduled';
  END IF;
END $$;

-- Seed lifecycle from the existing name convention. The four default stages are
-- named exactly after the statuses, so they map one-to-one; anything else keeps
-- the 'scheduled' default until the tenant says otherwise.
UPDATE job_pipeline_stages
SET lifecycle = name::job_status
WHERE name IN ('scheduled', 'in_progress', 'completed', 'cancelled')
  AND lifecycle <> name::job_status;

-- ── JOB-01: jobs.stage_id ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'stage_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN stage_id uuid;
  END IF;
END $$;

-- Backfill from the name<->status convention that has been in force until now.
UPDATE jobs j
SET stage_id = s.id
FROM job_pipeline_stages s
WHERE j.stage_id IS NULL
  AND j.pipeline_id IS NOT NULL
  AND s.pipeline_id = j.pipeline_id
  AND s.name = j.status;

-- Any job whose status has no matching stage in its pipeline (a stage deleted
-- out from under it) falls back to that pipeline's first stage by sort order,
-- so no job is left unreachable on the board.
UPDATE jobs j
SET stage_id = fallback.id,
    status = fallback.name
FROM (
  SELECT DISTINCT ON (pipeline_id) pipeline_id, id, name
  FROM job_pipeline_stages
  ORDER BY pipeline_id, sort_order ASC
) fallback
WHERE j.stage_id IS NULL
  AND j.pipeline_id IS NOT NULL
  AND fallback.pipeline_id = j.pipeline_id;

-- ON DELETE SET NULL, not CASCADE: deleting a stage must never delete jobs.
-- The API re-homes affected jobs before allowing the stage delete; this is the
-- backstop for anything that bypasses it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_stage_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_stage_id_fkey
      FOREIGN KEY (stage_id) REFERENCES job_pipeline_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_stage_id ON jobs (stage_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_archived ON jobs (tenant_id, archived_at);

-- ── JOB-27: calendar_events.job_id foreign key ──────────────────────────────
UPDATE calendar_events
SET job_id = NULL
WHERE job_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = calendar_events.job_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_job_id_fkey'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT calendar_events_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_events_job_id ON calendar_events (job_id);

-- ── JOB-27: job_documents.customer_id foreign key ───────────────────────────
UPDATE job_documents
SET customer_id = NULL
WHERE customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = job_documents.customer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_documents_customer_id_fkey'
  ) THEN
    ALTER TABLE job_documents
      ADD CONSTRAINT job_documents_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── JOB-42: job_line_items.updated_at ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_line_items' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE job_line_items
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
