-- ============================================================================
-- Making an automation an author (P3 prerequisites A-1 and A-2)
--
-- Two places in the schema assume every action has a human behind it. An
-- automation does not, and both would have stopped a P3 node dead:
--
--   A-1  customer_notes.created_by is NOT NULL and FKs to "user". The
--        `customer.addNote` node has no user, so it could not write a row at
--        all. Making the column nullable is only half the fix — a note with no
--        author reads as a bug. It needs to be able to say *which automation*
--        wrote it, which is why created_by_workflow_id lands with it.
--
--   A-2  notification_type has ten values and none of them is an automation.
--        `notification.internal` calls dispatchNotification(), whose `type` is
--        this enum, and notification_channel_config is keyed on it — so a new
--        value is a migration and a per-user channel default, not a string.
--
-- customer_activities.performed_by was already nullable, which is why only the
-- notes table appears here.
--
-- Idempotent throughout ([[strict-rules]] §1).
-- ============================================================================

-- ── A-2: the notification type ──────────────────────────────────────────────
-- ADD VALUE IF NOT EXISTS is idempotent by itself, but it cannot run inside a
-- transaction block in PostgreSQL < 12 and cannot be used in the same
-- transaction as a query referencing the new value. Neon is 18.4, so the first
-- restriction is gone; the second is why nothing below reads 'workflow_alert'.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workflow_alert';

COMMENT ON TYPE notification_type IS
  'In-app/email notification kinds. workflow_alert is what the notification.internal automation node raises — deliberately one value rather than one per node, because a tenant muting "automations" means all of them.';

-- ── A-1: an automation can author a note ────────────────────────────────────
-- Drop NOT NULL. Every existing row keeps its author; only new rows written by
-- the engine will have NULL here.
ALTER TABLE customer_notes
  ALTER COLUMN created_by DROP NOT NULL;

-- Which automation wrote it. SET NULL rather than CASCADE: deleting an
-- automation must not delete the notes it wrote — the note is a record of
-- something that happened to this customer, and it outlives the thing that
-- caused it. Same reasoning as workflow_executions.customer_id.
ALTER TABLE customer_notes
  ADD COLUMN IF NOT EXISTS created_by_workflow_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_notes_created_by_workflow_id_fkey'
  ) THEN
    ALTER TABLE customer_notes
      ADD CONSTRAINT customer_notes_created_by_workflow_id_fkey
      FOREIGN KEY (created_by_workflow_id) REFERENCES workflows(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN customer_notes.created_by IS
  'The user who wrote this note. NULL when an automation did — see created_by_workflow_id. Exactly one of the two is set.';
COMMENT ON COLUMN customer_notes.created_by_workflow_id IS
  'The automation that wrote this note, when it was not a person. Lets the UI say "Added by Quote follow-up" instead of leaving the author blank, which reads as a bug.';

-- Partial: only automation-written notes, which will be a small minority. The
-- question asked of this column is "what has this automation written", never
-- "which notes have no workflow".
CREATE INDEX IF NOT EXISTS idx_customer_notes_workflow
  ON customer_notes (created_by_workflow_id)
  WHERE created_by_workflow_id IS NOT NULL;
