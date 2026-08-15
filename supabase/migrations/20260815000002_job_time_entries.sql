-- Job time tracking — the missing input to the costing feature.
--
-- Idempotent throughout, per strict-rules §1: every object guarded, every re-run
-- a no-op. These files are applied by hand through `postgres.js` (`pnpm db:apply`),
-- and a hand-applied migration is one interrupted connection away from a second run.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Why
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `jobs.actual_hours` was one number, per job, typed by hand into a box on the
-- Costs tab days after the work, multiplied by one rate resolved from the job's
-- assignee. Nothing prompted for it, so it was empty; a job worked by two people
-- could not be represented at all; and `buildCoverage()` spent its life emitting
-- "No hours recorded for this job". Labour is usually the largest cost line on a
-- service job, so the entire costing feature rested on a field nobody filled in.
--
-- After this migration, entries are the source and `jobs.actual_hours` is a
-- denormalised cache maintained in the same transaction as every entry write —
-- exactly the arrangement `recalculateJobTotals` already gives `jobs.total_amount`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · job_time_entries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Who did the work. Not necessarily who recorded it — an owner can add an
  -- entry for a tech who forgot, and the cost must follow the person who did the
  -- work, not the person who typed it in.
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

  started_at timestamptz NOT NULL,

  -- NULL means the clock is still running. Every cost query filters on
  -- `ended_at IS NOT NULL`, so a running timer contributes nothing until it
  -- stops — otherwise a job's margin would move on every page refresh.
  ended_at timestamptz,

  -- Nullable on purpose. `resolveLaborCostRate` already treats null as a real
  -- answer meaning "labour cost is unknown", and its docblock is explicit that
  -- callers must not turn it into 0 — a zero rate reports every job's labour as
  -- free, which is the single most misleading thing this feature could say.
  -- An entry with no rate contributes hours but no cost, and coverage says so.
  --
  -- Snapshotted rather than joined, for the same reason jobs.labor_cost_rate is:
  -- a raise must not rewrite last year's margins.
  hourly_cost_rate numeric(10,2),

  note text,

  -- Closed by the sweep rather than by a person, because the timer ran past the
  -- ceiling. The hours still count (the time is probably partly real) but
  -- coverage reports it, so an auto-stop is neither silently trusted nor
  -- silently discarded.
  auto_stopped boolean NOT NULL DEFAULT false,

  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A closed entry must end after it started. Zero-length is refused too: an
  -- entry that took no time is a mis-click, and letting it through puts a row in
  -- the timesheet that reads as work.
  CONSTRAINT job_time_entries_ends_after_start
    CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_job_time_entries_tenant_job
  ON job_time_entries (tenant_id, job_id);

CREATE INDEX IF NOT EXISTS idx_job_time_entries_tenant_user_started
  ON job_time_entries (tenant_id, user_id, started_at);

-- One running timer per person, enforced by the database.
--
-- PARTIAL, which is the whole point: it makes "clocked into two jobs at once"
-- unexpressible, while still letting the same person start a new timer once the
-- last one has stopped. The same device `idx_goal_listeners_match` uses, and for
-- the same reason — an application-side check races with itself, this cannot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_time_entries_one_running
  ON job_time_entries (tenant_id, user_id)
  WHERE ended_at IS NULL;

-- The sweep's hot query: find every timer still running past the ceiling.
-- Partial for the same reason — running entries are a vanishing fraction of the
-- table, and a full index would be almost entirely dead weight.
CREATE INDEX IF NOT EXISTS idx_job_time_entries_running
  ON job_time_entries (started_at)
  WHERE ended_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Backfill: no job loses the hours somebody already typed
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Every job carrying `actual_hours` gets exactly one entry standing in for it.
-- `started_at` is anchored to the job's completion (falling back to its own
-- created_at) and the entry runs backwards from there for the recorded hours, so
-- the timesheet reads plausibly instead of landing at epoch.
--
-- `user_id` is the job's assignee. A job with hours and **no** assignee has
-- nobody to attribute the time to, so it is deliberately skipped and its hours
-- are left in the cache column — reporting an unattributable cost against an
-- arbitrary person would be worse than reporting it against nobody. Those jobs
-- surface as a coverage gap, which is the honest outcome.
--
-- Guarded by NOT EXISTS on the job, so re-running matches zero rows: the second
-- pass finds the entry the first pass wrote. That is what makes it converge.

INSERT INTO job_time_entries (
  tenant_id, job_id, user_id, started_at, ended_at,
  hourly_cost_rate, note, created_by
)
SELECT
  j.tenant_id,
  j.id,
  j.assignee_id,
  COALESCE(j.completed_at, j.created_at) - (j.actual_hours * INTERVAL '1 hour'),
  COALESCE(j.completed_at, j.created_at),
  j.labor_cost_rate,
  'Hours recorded before time tracking',
  NULL
FROM jobs j
WHERE j.actual_hours IS NOT NULL
  AND j.actual_hours > 0
  AND j.assignee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_time_entries t
    WHERE t.tenant_id = j.tenant_id AND t.job_id = j.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Re-derive the cache from what is now the source
-- ─────────────────────────────────────────────────────────────────────────────
--
-- After this, `jobs.actual_hours` equals the sum of the job's closed entries for
-- every job that has any. Jobs skipped by the backfill above keep their typed
-- value — the NOT EXISTS guard means they have no entries to be re-derived from,
-- and zeroing them would destroy the only record of that labour.
--
-- `jobs.labor_cost_rate` is deliberately left alone. Nothing reads it for money
-- any more (costing sums per-entry rates), but the backfill above is the only
-- thing that can reconstruct an entry's rate, so it stays until that backfill is
-- proven on real data. Dropping it is a follow-up, not part of this migration.

UPDATE jobs j
SET actual_hours = t.hours,
    updated_at = now()
FROM (
  SELECT
    tenant_id,
    job_id,
    ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600, 2) AS hours
  FROM job_time_entries
  WHERE ended_at IS NOT NULL
  GROUP BY tenant_id, job_id
) t
WHERE j.tenant_id = t.tenant_id
  AND j.id = t.job_id
  AND (j.actual_hours IS DISTINCT FROM t.hours);
