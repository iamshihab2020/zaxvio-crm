-- ============================================================================
-- Workflow automation — P2: the transactional outbox
--
-- One table. A domain service that changes something inserts here in its own
-- transaction, so the event and the change commit together or not at all, and
-- a worker claims the rows afterwards.
--
-- Idempotent throughout (strict-rules §1): every statement is guarded, and
-- re-running the file is a no-op. Verified by execution.
-- ============================================================================

-- ── Enum ────────────────────────────────────────────────────────────────────
-- `CREATE TYPE` has no IF NOT EXISTS, so it needs the catalog guard.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_event_status') THEN
    CREATE TYPE workflow_event_status AS ENUM (
      'pending', 'processing', 'completed', 'failed', 'cancelled'
    );
  END IF;
END $$;

-- ── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_event_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  event_type       text NOT NULL,
  payload          jsonb NOT NULL,

  subject_type     workflow_subject_type,
  subject_id       uuid,
  -- text, not uuid: Better Auth owns user.id and types it text. No FK — the
  -- history of what a user did must survive the user.
  actor_user_id    text,

  -- One row per subscriber. A failure in one must never retry the other.
  subscriber       text NOT NULL,

  status           workflow_event_status NOT NULL DEFAULT 'pending',
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 5,
  last_error       text,

  scheduled_at     timestamptz NOT NULL DEFAULT now(),
  claimed_at       timestamptz,
  processed_at     timestamptz,
  next_retry_at    timestamptz,

  correlation_id   uuid NOT NULL,
  dedup_key        text,

  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

-- The claim path: filter on status, order by scheduled_at. One index answers
-- both, so the planner never sorts a batch it is about to lock.
CREATE INDEX IF NOT EXISTS idx_wf_queue_claim
  ON workflow_event_queue (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_wf_queue_retry
  ON workflow_event_queue (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_wf_queue_tenant
  ON workflow_event_queue (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wf_queue_correlation
  ON workflow_event_queue (correlation_id);

-- The stale-recovery sweep: rows left in 'processing' by a process that died.
CREATE INDEX IF NOT EXISTS idx_wf_queue_stale
  ON workflow_event_queue (status, claimed_at);

-- Structural dedup. Partial, so rows without a key cost nothing and — more to
-- the point — do not collide with each other, since NULLs are distinct in a
-- plain unique index but the planner still has to carry them.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_queue_dedup
  ON workflow_event_queue (dedup_key, subscriber)
  WHERE dedup_key IS NOT NULL;

-- ── Documentation ───────────────────────────────────────────────────────────
-- COMMENT ON is idempotent by definition: it replaces.

COMMENT ON TABLE workflow_event_queue IS
  'Transactional outbox for workflow automation. Producers insert inside their own transaction; a worker claims rows with FOR UPDATE SKIP LOCKED. One row per subscriber.';

COMMENT ON COLUMN workflow_event_queue.payload IS
  'Zod-validated by the producer before insert and again by the worker after read. The second parse catches a deploy that changed a payload shape while rows were already queued.';

COMMENT ON COLUMN workflow_event_queue.subscriber IS
  'workflow_trigger | goal_listener. Separate rows so a failing subscriber cannot retry the other one.';

COMMENT ON COLUMN workflow_event_queue.dedup_key IS
  'Producer-supplied. Unique per subscriber where present, so a double-fired producer enqueues once. Structural, not check-then-insert.';

COMMENT ON COLUMN workflow_event_queue.status IS
  'failed is a dead letter, kept 30 days for an operator to see. cancelled means there was nothing to do, not that something broke.';
