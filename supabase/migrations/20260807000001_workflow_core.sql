-- Workflow automation — core schema.
-- Idempotent: safe to run repeatedly (strict-rules §1).
--
-- Design and reasoning: docs/workflow-automation/wf-03-data-model.md
--
-- Six tables plus a folder table, four enums. Three decisions are visible in
-- the DDL and are worth naming here, because they are the ones a future reader
-- will be tempted to "simplify":
--
--   1. `workflow_versions` holds a JSONB snapshot of the whole graph, and an
--      execution points at a version rather than at the workflow. That is what
--      makes editing a live automation safe: a run that paused for three days
--      resumes against the graph it started with, not one that may no longer
--      contain its next node.
--
--   2. `workflow_edges.source_handle` is a COLUMN, and it holds a stable id
--      ('found'), never the display label ('Found'). It is routing logic, so it
--      must be queryable — and a label that routes means renaming a branch
--      silently breaks every saved automation.
--
--   3. Two PARTIAL UNIQUE indexes on `workflow_executions` replace what would
--      otherwise be a query-then-insert race. `idempotency_key` stops one event
--      delivered twice from creating two runs; `active_dedup_key` stops a
--      second event for a subject already mid-run from starting a parallel one.
--      A 23505 on either is a control-flow signal, not an error.
--
-- `node_execution_logs.node_id` deliberately has NO foreign key: deleting a
-- node from the draft graph must not delete the record of what it did, and the
-- node it names may exist only inside an old published snapshot.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Enums. CREATE TYPE has no IF NOT EXISTS, so guard on the catalog.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_subject_type') THEN
    CREATE TYPE workflow_subject_type AS ENUM (
      'customer',
      'job',
      'invoice',
      'quote',
      'booking',
      'equipment',
      'maintenance_contract'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_execution_status') THEN
    CREATE TYPE workflow_execution_status AS ENUM (
      'running',
      'waiting',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_execution_source') THEN
    CREATE TYPE workflow_execution_source AS ENUM (
      'event',
      'manual',
      'test',
      'webhook',
      'schedule',
      'sub',
      'replay'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'node_execution_status') THEN
    CREATE TYPE node_execution_status AS ENUM (
      'running',
      'completed',
      'failed',
      'waiting',
      'skipped'
    );
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Folders.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_folders_tenant
  ON workflow_folders (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Workflows.
--
--     `is_active` defaults to FALSE. A drawing tool that starts emailing
--     customers the moment a trigger lands on the canvas is a bad idea; the
--     cost is an unmissable "this is off" banner in the builder, which is owed
--     anyway.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT FALSE,
  -- FK added in step 5, once workflow_versions exists.
  active_version_id  UUID,
  folder_id          UUID REFERENCES workflow_folders(id) ON DELETE SET NULL,
  timezone_mode      TEXT NOT NULL DEFAULT 'tenant',
  timezone           TEXT,
  template_key       TEXT,
  created_by         TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Also the optimistic-concurrency token for the whole-graph save.
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_active
  ON workflows (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_archived
  ON workflows (tenant_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_workflows_folder
  ON workflows (folder_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Published versions — the immutable graph snapshot.
--
--     `trigger_types` is denormalised out of the snapshot so the trigger
--     matcher finds candidate workflows with an index instead of parsing every
--     graph. That query runs on every dispatched event, so it is the hottest
--     read in the whole feature.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id   UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  graph         JSONB NOT NULL,
  trigger_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  node_count    INTEGER NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  note          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_versions_unique
  ON workflow_versions (workflow_id, version);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow
  ON workflow_versions (workflow_id, published_at);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_tenant
  ON workflow_versions (tenant_id);
-- GIN so `trigger_types && ARRAY[...]` is an index scan.
CREATE INDEX IF NOT EXISTS idx_workflow_versions_trigger_types
  ON workflow_versions USING GIN (trigger_types);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · The cycle: workflows.active_version_id → workflow_versions.
--     SET NULL, never CASCADE — pruning an old version must not delete the
--     automation that once pointed at it.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflows_active_version_id_fkey'
  ) THEN
    ALTER TABLE workflows
      ADD CONSTRAINT workflows_active_version_id_fkey
      FOREIGN KEY (active_version_id)
      REFERENCES workflow_versions(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · The draft graph.
--
--     Node and edge ids are CLIENT-minted, so no DEFAULT here: the whole-graph
--     save diffs by id, and an id that survives a publish is what lets a replay
--     match a historic node log to a node the user still recognises.
--
--     Edge endpoints are plain UUIDs with no FK. A save deletes and re-inserts
--     inside one transaction; an FK would impose an ordering constraint for no
--     benefit, and the graph validator has to check referential sanity anyway
--     because the published snapshot needs it too.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_type   TEXT NOT NULL,
  node_config JSONB NOT NULL,
  position_x  INTEGER NOT NULL DEFAULT 0,
  position_y  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow
  ON workflow_nodes (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_tenant
  ON workflow_nodes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_type
  ON workflow_nodes (node_type);

CREATE TABLE IF NOT EXISTS workflow_edges (
  id             UUID PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id    UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL,
  source_handle  TEXT NOT NULL DEFAULT 'main',
  target_node_id UUID NOT NULL,
  label          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow
  ON workflow_edges (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source
  ON workflow_edges (source_node_id, source_handle);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target
  ON workflow_edges (target_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_tenant
  ON workflow_edges (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7 · Executions.
--
--     `workflow_version_id` is ON DELETE RESTRICT: a version with a run
--     attached cannot be pruned. The retention sweep checks for non-terminal
--     runs before deleting a version, and this constraint is what makes that
--     check load-bearing rather than polite.
--
--     `customer_id` is ON DELETE SET NULL: deleting a customer must not erase
--     the history of what was done on their behalf.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_executions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id          UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workflow_version_id  UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE RESTRICT,

  subject_type         workflow_subject_type,
  subject_id           UUID,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,

  status               workflow_execution_status NOT NULL DEFAULT 'running',
  source               workflow_execution_source NOT NULL,

  trigger_node_id      UUID,
  trigger_event        TEXT,

  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ,
  error_message        TEXT,
  -- The same failure in words the person who has to fix it would use.
  error_hint           TEXT,

  resume_at            TIMESTAMPTZ,
  current_node_id      UUID,
  waiting_context      JSONB,
  context_truncated    BOOLEAN NOT NULL DEFAULT FALSE,

  parent_execution_id  UUID,

  idempotency_key      TEXT,
  active_dedup_key     TEXT,

  nodes_executed       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_wf_exec_workflow
  ON workflow_executions (workflow_id, started_at);
CREATE INDEX IF NOT EXISTS idx_wf_exec_tenant_status
  ON workflow_executions (tenant_id, status);
-- THE resume query.
CREATE INDEX IF NOT EXISTS idx_wf_exec_resume
  ON workflow_executions (status, resume_at);
CREATE INDEX IF NOT EXISTS idx_wf_exec_subject
  ON workflow_executions (tenant_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_wf_exec_customer
  ON workflow_executions (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_wf_exec_parent
  ON workflow_executions (parent_execution_id);

-- The two partial unique indexes. `IF NOT EXISTS` covers re-runs; a CHANGED
-- predicate would need a drop, which is a separate migration by design —
-- silently redefining a uniqueness rule is not something to do implicitly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_exec_idempotency
  ON workflow_executions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_exec_active_dedup
  ON workflow_executions (active_dedup_key)
  WHERE active_dedup_key IS NOT NULL
    AND status IN ('running', 'waiting');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8 · Node logs.
--
--     `node_id` has NO foreign key, on purpose: deleting a node from the draft
--     graph must not delete the record of what it did, and the node it names
--     may exist only inside an old published snapshot.
--
--     Rows are written for `skipped` and `waiting` too, not only the terminal
--     states — the replay view depends on it. A disabled node that leaves no
--     row reads as a node that was never reached, which is the opposite of
--     what happened.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_execution_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id      UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,

  node_id           UUID NOT NULL,

  -- Denormalised so an operator can query failures without three joins.
  workflow_id       UUID NOT NULL,
  node_type         TEXT NOT NULL,
  node_label        TEXT,
  sequence          INTEGER NOT NULL,

  status            node_execution_status NOT NULL,
  skip_reason       TEXT,

  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  duration_ms       INTEGER,

  -- Always stored: what this node actually tried to do, post-interpolation.
  -- Small, and it answers most of "why did this happen". Secrets redacted.
  resolved_params   JSONB,
  output            JSONB,
  -- Failed nodes and test runs only. A full context per node per run is what
  -- makes this table unmanageable, and a node that succeeded is not the one
  -- being debugged.
  context_snapshot  JSONB,

  error_message     TEXT,
  error_hint        TEXT
);

CREATE INDEX IF NOT EXISTS idx_node_logs_execution
  ON node_execution_logs (execution_id, sequence);
CREATE INDEX IF NOT EXISTS idx_node_logs_tenant_status
  ON node_execution_logs (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_node_logs_workflow_status
  ON node_execution_logs (workflow_id, status);
-- The retention sweep.
CREATE INDEX IF NOT EXISTS idx_node_logs_started
  ON node_execution_logs (started_at);

-- The at-most-once guard: a resume that finds an existing row for a node that
-- sends refuses rather than sending twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_node_logs_attempt
  ON node_execution_logs (execution_id, node_id, sequence);
