-- Job profitability & costing.
-- Idempotent: safe to run repeatedly (strict-rules §1).
--
-- Answers "did this job make money?", which the schema previously could not:
-- `jobs` carried subtotal/tax/total (revenue) and nothing at all about cost.
--
-- The single rule this migration encodes: **an unknown cost is NULL, never 0**.
-- Every cost column below is nullable and none defaults to zero. A zero default
-- would report 100% margin on every uncosted item and quietly tell a contractor
-- they are profitable when they are not — the exact failure this feature exists
-- to prevent. Readers treat NULL as a missing input and mark the margin
-- provisional instead of inventing a number.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Expense category enum.
--     CREATE TYPE has no IF NOT EXISTS, so guard on the catalog.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE expense_category AS ENUM (
      'material',
      'subcontractor',
      'permit',
      'fuel',
      'equipment_rental',
      'other'
    );
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Cost beside price.
--     `catalog_items.unit_price` is what you charge; `unit_cost` is what you
--     pay. Line items snapshot the catalog cost at add time rather than joining
--     it, exactly as `unit_price` has always been snapshotted — a supplier
--     price change must not silently rewrite the margin on a closed job.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10, 2);

ALTER TABLE job_line_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10, 2);

-- Generated twin of `total` (quantity * unit_price). NULL propagates through
-- the multiplication, so an uncosted line stays visibly uncosted rather than
-- contributing a silent zero to the job's cost.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_line_items' AND column_name = 'cost_total'
  ) THEN
    ALTER TABLE job_line_items
      ADD COLUMN cost_total NUMERIC(10, 2)
      GENERATED ALWAYS AS (quantity * unit_cost) STORED;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Actual labour on the job.
--     Line items record what was *billed*. A job quoted at a 3-hour flat rate
--     that took 5 hours shows healthy margin if billed labour is all you
--     measure, so actual hours are captured separately.
--
--     `labor_cost_rate` is snapshotted onto the job for the same reason as
--     unit_cost above: raising your rate must not retroactively move history.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6, 2);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS labor_cost_rate NUMERIC(10, 2);

-- Loaded hourly cost (wage + burden), the fallback when a job's assignee has no
-- per-member override. NULL = not configured, so labour reports as a missing
-- input rather than as free.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_labor_cost_rate NUMERIC(10, 2);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Job expenses — cost that never reaches a line item.
--     The supply-house run, the permit, the sub. For a service business this is
--     where most real cost hides, and none of it is visible from the invoice.
--
--     No `billable` flag: nothing in the product can turn a flagged expense
--     into a line item, so the flag would be a promise the code does not keep.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  job_id         UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  category       expense_category NOT NULL DEFAULT 'material',
  description    TEXT NOT NULL,
  amount         NUMERIC(10, 2) NOT NULL,
  -- Not the job's scheduled date: parts are routinely bought days ahead.
  incurred_on    DATE NOT NULL,
  vendor         TEXT,
  created_by     TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_expenses_tenant_job
  ON job_expenses (tenant_id, job_id);

-- The profitability report aggregates expenses over a date window.
CREATE INDEX IF NOT EXISTS idx_job_expenses_tenant_incurred
  ON job_expenses (tenant_id, incurred_on);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Per-member hourly cost override.
--     Its own table rather than a column on "user" or "member": those belong to
--     Better Auth, and this application writes into a plugin's schema as little
--     as it can. A member with no row falls back to the tenant default.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_member_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  hourly_cost_rate  NUMERIC(10, 2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One rate per member per tenant. Also the index the resolver reads.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_member_rates_tenant_user
  ON tenant_member_rates (tenant_id, user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · Supporting indexes for the profitability report.
--     It groups completed jobs by service_type / assignee / customer over a
--     date window, and joins invoices back by job_id (already indexed as
--     idx_invoices_tenant_job by the invoices audit).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_completed_at
  ON jobs (tenant_id, completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_assignee
  ON jobs (tenant_id, assignee_id)
  WHERE assignee_id IS NOT NULL;

-- job_line_items is read once per job by the costing rollup and once per group
-- by the report; it had no tenant/job composite index.
CREATE INDEX IF NOT EXISTS idx_job_line_items_tenant_job
  ON job_line_items (tenant_id, job_id);
