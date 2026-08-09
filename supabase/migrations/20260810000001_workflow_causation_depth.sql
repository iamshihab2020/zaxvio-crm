-- Causation depth: how many automations deep a chain is.
--
-- P7a routed the job executors through their domain services, so an automation
-- that moves a job now raises job.stage_changed like every other writer. That
-- is the fix for a real defect (an automation could not trigger another
-- automation, and trigger.job.stage_changed shipped unreachable) and it opens a
-- hazard in the same motion: two automations triggering each other cycle
-- through the outbox forever.
--
-- execute() already had a depth guard. It only ever covered one automation
-- calling another DIRECTLY -- an event-triggered run starts fresh, because an
-- event carried no history. These two columns are that history.
--
-- Both default to 0, so every row already in either table reads as "started by
-- a person", which is what they were.
--
-- Idempotent throughout (strict-rules §1): ADD COLUMN IF NOT EXISTS is safe to
-- re-run and leaves existing data untouched.

ALTER TABLE workflow_event_queue
  ADD COLUMN IF NOT EXISTS causation_depth integer NOT NULL DEFAULT 0;

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS causation_depth integer NOT NULL DEFAULT 0;

-- No index. Neither column is ever a predicate: the queue row is read by id
-- after the claim, and the execution row by id on resume. It is carried, not
-- searched.
