-- P9 — inbound webhooks, schedules, and the one column a viewed-quote trigger needs.
--
-- Idempotent throughout, per strict-rules §1: every object guarded, every
-- re-run a no-op. This file has to be safe to apply twice because the previous
-- four migrations were applied by hand through `postgres.js` (there is no psql
-- on the machine that runs them and `db:migrate` skips hand-written files), and
-- a hand-applied migration is one interrupted connection away from a second run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · workflow_webhooks
-- ─────────────────────────────────────────────────────────────────────────────
--
-- One row per webhook endpoint. The **path token** is what appears in the URL
-- and is not a secret — it identifies, it does not authorise. The secret is
-- separate and stored hashed, so a database leak does not hand over the ability
-- to fire every tenant's automations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_auth_mode') THEN
    -- No 'hmac'. Verifying an HMAC requires holding the key, and secret_hash
    -- below stores a sha256 on purpose — a sender signs with the secret and a
    -- hash-only verifier checks against something else, so the mode could never
    -- validate a single request. It shipped in the first draft of this file and
    -- would have failed silently and permanently, because every refusal on this
    -- endpoint returns the same 404. Adding it back needs encrypted-at-rest
    -- secret storage first.
    CREATE TYPE webhook_auth_mode AS ENUM ('none', 'secret');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS workflow_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- The URL segment. Random, unguessable, and **globally unique** rather than
  -- unique per tenant: the receiver is public and has no tenant in scope until
  -- it has resolved this, so a token that collided across tenants would make
  -- the lookup ambiguous at exactly the moment there is nothing to disambiguate
  -- it with.
  path_token text NOT NULL,

  auth_mode webhook_auth_mode NOT NULL DEFAULT 'secret',
  -- sha256 of the secret. Never the secret itself — it is shown in full once,
  -- at creation, and never again.
  secret_hash text,
  -- Last four characters, so the UI can say *which* secret this is without
  -- being able to reconstruct it.
  secret_hint text,

  description text,
  is_active boolean NOT NULL DEFAULT true,

  -- Observability without a second table. "It fired but nothing happened" and
  -- "it never fired" are different problems and this is what tells them apart.
  last_received_at timestamptz,
  received_count integer NOT NULL DEFAULT 0,

  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique globally, and the receiver's only lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_webhooks_token
  ON workflow_webhooks (path_token);

CREATE INDEX IF NOT EXISTS idx_workflow_webhooks_workflow
  ON workflow_webhooks (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_webhooks_tenant
  ON workflow_webhooks (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · workflow_schedule_state
-- ─────────────────────────────────────────────────────────────────────────────
--
-- "Once only" has to survive a restart, and the only way it does is by being a
-- row rather than a timer. One row per (workflow, key): the key is what makes
-- a daily schedule idempotent per calendar day and a warranty reminder
-- idempotent per equipment record.
--
-- This is the same shape as the outbox's `dedup_key`, and deliberately not the
-- same table: the outbox is a queue that is swept away by retention, and a
-- schedule's memory of what it has already done must outlive that.

CREATE TABLE IF NOT EXISTS workflow_schedule_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,

  -- What this row remembers. `schedule.daily:2026-08-15`,
  -- `warranty:<equipmentId>`, `contract-visit:<contractId>:2026-09`.
  dedup_key text NOT NULL,
  -- Which sweep wrote it, so one sweep's rows can be reaped without touching
  -- another's.
  kind text NOT NULL,

  fired_at timestamptz NOT NULL DEFAULT now()
);

-- The whole point of the table. A second attempt at the same key raises 23505
-- and the sweep treats that as "already done" rather than as an error.
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_state_key
  ON workflow_schedule_state (tenant_id, dedup_key);

-- For the reaper. Partial on nothing — every row ages out — but keyed on kind
-- so a sweep can be retired without a full scan.
CREATE INDEX IF NOT EXISTS idx_schedule_state_reap
  ON workflow_schedule_state (kind, fired_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · quotes.first_viewed_at
-- ─────────────────────────────────────────────────────────────────────────────
--
-- For `trigger.quote.viewed`. **First** viewed, not last: the automation worth
-- building is "they opened it and did nothing for two days", and a column that
-- moved on every view would restart that clock every time they looked again.
--
-- Nullable with no default, like every other column added by this project's
-- costing work — a default would assert that every existing quote was viewed at
-- the moment of the migration, which is false for all of them.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

-- Partial: the sweep and the reporting only ever ask about quotes that *have*
-- been viewed, and the majority of rows in a healthy table have not.
CREATE INDEX IF NOT EXISTS idx_quotes_first_viewed
  ON quotes (tenant_id, first_viewed_at)
  WHERE first_viewed_at IS NOT NULL;
