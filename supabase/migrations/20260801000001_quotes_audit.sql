-- Quotes audit remediation — QUO-02 (backfill), QUO-24, QUO-25.
-- Idempotent: safe to run repeatedly (strict-rules §1).
--
-- Report: docs/claude/reports/quotes.md

-- ─────────────────────────────────────────────────────────────────────────────
-- QUO-25 · quote_line_items had NO index beyond its primary key, so every
-- detail fetch, every PDF render, every send and every totals recalculation was
-- a sequential scan (verified: `Seq Scan on quote_line_items`). Same defect as
-- INV-33 on invoice_line_items, one table over.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quote_line_items_tenant_quote
  ON quote_line_items (tenant_id, quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_catalog_item
  ON quote_line_items (catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

-- Every quote list filters on archived_at; nothing indexed it.
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_archived
  ON quotes (tenant_id, archived_at);

-- The auto-expire sweep and the expiry-warning cron both scan on this pair.
CREATE INDEX IF NOT EXISTS idx_quotes_status_expiry
  ON quotes (status, expiry_date)
  WHERE expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUO-24 · access_token backed the public portal lookup with no index at all
-- (verified: `Seq Scan on quotes` on every unauthenticated page view) and no
-- uniqueness, so a collision would silently hand one customer another's quote.
--
-- Partial + UNIQUE: NULL tokens are the common case (every draft) and Postgres
-- does not compare NULLs in a unique index, but the partial predicate keeps the
-- index small and makes the intent explicit.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_access_token
  ON quotes (access_token)
  WHERE access_token IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUO-02 · Backfill jobs.stage_id for jobs created from quotes.
--
-- `lib/quote-to-job.ts` wrote jobs.status by hand and never set stage_id, so
-- these jobs count as 0 in the stage-keyed pipeline counts, match no lifecycle
-- filter, and are stranded on the board if their stage is deleted.
--
-- Only touches rows where the match is unambiguous: the job has a pipeline, no
-- stage, and exactly one stage in that pipeline carries its status as a name.
-- Deliberately does NOT guess for jobs whose status matches no stage — those are
-- reported by the verification query rather than silently re-homed.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE jobs j
SET stage_id = s.id
FROM job_pipeline_stages s
WHERE j.stage_id IS NULL
  AND j.pipeline_id IS NOT NULL
  AND s.pipeline_id = j.pipeline_id
  AND s.tenant_id = j.tenant_id
  AND s.name = j.status;

-- Second pass: a job whose status is a canonical lifecycle value rather than a
-- stage name (the literal "scheduled" fallback the old code wrote when the
-- tenant had no default pipeline) lands on the lowest-sorted stage of that
-- lifecycle.
UPDATE jobs j
SET stage_id = s.id
FROM (
  SELECT DISTINCT ON (pipeline_id, lifecycle)
         id, pipeline_id, tenant_id, lifecycle
  FROM job_pipeline_stages
  ORDER BY pipeline_id, lifecycle, sort_order
) s
WHERE j.stage_id IS NULL
  AND j.pipeline_id IS NOT NULL
  AND s.pipeline_id = j.pipeline_id
  AND s.tenant_id = j.tenant_id
  AND s.lifecycle::text = j.status;

-- Keep jobs.status consistent with the stage now pointed at, so the board's
-- name-keyed grouping and the stage-keyed counts agree.
UPDATE jobs j
SET status = s.name
FROM job_pipeline_stages s
WHERE j.stage_id = s.id
  AND j.tenant_id = s.tenant_id
  AND j.status <> s.name;
