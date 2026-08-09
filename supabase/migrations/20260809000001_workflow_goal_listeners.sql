-- ============================================================================
-- Goals — "stop chasing them once they book" (P6, wf-03 §3.8, wf-00 D-04)
--
-- A goal is the opposite of a trigger. A trigger asks "did something happen
-- that should START a run"; a goal asks "did something happen that should END
-- one already in flight". Both answer it from the same dispatched event and
-- with the same filter evaluator, which is why a goal costs a table and a
-- lookup rather than a second matching engine.
--
-- The row is what makes it durable. A three-day chase sequence outlives every
-- process that could have held the watch in memory, and the system this was
-- ported from keeps its equivalent in a module-level Map — so "once only"
-- there means "once per replica per uptime window".
--
-- ## Why the run pauses with resume_at NULL
--
-- `workflow_executions.resume_at` is the clock the resume worker polls. A goal
-- wait has no clock: only a matching event ends it. Writing a resume_at would
-- make the worker wake the run and carry on past the goal, which is exactly the
-- thing the author asked not to happen. execute.ts already pauses goal waits
-- with NULL — this table is the other half of that.
--
-- ## The reaper
--
-- A run waiting on a goal nobody ever meets waits forever. wf-05 §5.6 caps that
-- at 30 days, for the same reason §9.4 gives for approvals: without an expiry,
-- one undecided wait strands a run and its subject permanently.
--
-- Idempotent throughout ([[strict-rules]] §1).
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_goal_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- CASCADE, unlike almost everything else pointing at a run. A listener is not
  -- a record of something that happened — it is a live watch, meaningless
  -- without the run it would end. Retention deletes terminal executions, and a
  -- listener outliving its execution would be a watch that can never fire.
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,

  -- The goal node inside the version's graph snapshot. Not an FK: workflow_nodes
  -- holds the DRAFT, and a run is pinned to a published version whose nodes live
  -- in the snapshot. An FK here would break the moment the author deleted the
  -- step from their draft — while the run legitimately continues on the old one.
  node_id UUID NOT NULL,

  subject_type workflow_subject_type NOT NULL,
  subject_id UUID NOT NULL,

  -- An EVENT name — `booking.created` — matching workflow_versions.trigger_types
  -- and never a node id. That distinction has now been the cause of two separate
  -- outages in this feature, so it is stated in the column comment below too.
  goal_event TEXT NOT NULL,

  -- Extra conditions, evaluated by the SAME matcher as trigger filters. "Goal:
  -- a booking is created **for this customer**" is the common case and costs no
  -- new code.
  goal_filter JSONB NOT NULL DEFAULT '{}'::jsonb,

  status TEXT NOT NULL DEFAULT 'active',
  met_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT workflow_goal_listeners_status_check
    CHECK (status IN ('active', 'met', 'inactive'))
);

-- THE lookup, run on every dispatched event that any goal watches for. Partial
-- on `status = 'active'`: met and inactive rows are kept for the run history and
-- must not cost anything on the hot path. Column order follows selectivity —
-- tenant first, then the subject, which together narrow it to almost nothing.
CREATE INDEX IF NOT EXISTS idx_goal_listeners_match
  ON workflow_goal_listeners (tenant_id, subject_type, subject_id, goal_event)
  WHERE status = 'active';

-- Deactivating every listener for a run, which happens on each terminal
-- transition. Without this that is a sequential scan on every completed run.
CREATE INDEX IF NOT EXISTS idx_goal_listeners_execution
  ON workflow_goal_listeners (execution_id, status);

-- The reaper's scan: active listeners older than 30 days.
CREATE INDEX IF NOT EXISTS idx_goal_listeners_reaper
  ON workflow_goal_listeners (created_at)
  WHERE status = 'active';

-- One live watch per (run, node). A run that somehow registered twice would be
-- ended twice, and the second attempt would find the execution already terminal
-- — harmless but confusing in the history. Cheaper to make it unrepresentable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_listeners_one_per_node
  ON workflow_goal_listeners (execution_id, node_id)
  WHERE status = 'active';

COMMENT ON TABLE workflow_goal_listeners IS
  'Live "stop this run when X happens" watches. One row per goal.event node per run, deactivated on every terminal transition of the execution.';

COMMENT ON COLUMN workflow_goal_listeners.goal_event IS
  'An EVENT name (job.completed), never a node id (trigger.job.completed). The same distinction that made the trigger matcher silently match nothing, then loudly throw 22P02.';

COMMENT ON COLUMN workflow_goal_listeners.node_id IS
  'The goal node in the published snapshot. Deliberately not an FK to workflow_nodes, which holds the draft — a run is pinned to its version and must survive the author deleting the step.';

COMMENT ON COLUMN workflow_goal_listeners.status IS
  'active = watching · met = the goal fired and ended the run · inactive = the run ended some other way.';
