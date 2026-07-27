-- Bookings & Calendar audit remediation (BOOK-11, BOOK-28)
--
-- BOOK-11: `jobs.booking_id` carries the real booking -> job link but had no
--          foreign key, while `bookings.converted_to_job_id` had a proper FK and
--          was never written. Hard-deleting a booking left `jobs.booking_id`
--          pointing at nothing and the job's origin unrecoverable.
--
-- BOOK-28: one booking per hour per tenant was hardcoded in the slot query, so a
--          three-person team could accept one job an hour through the portal.
--
-- Idempotent per strict-rules §1.

-- ── BOOK-11: FK on jobs.booking_id ──────────────────────────────────────────
-- Clear any link that is already dangling, otherwise the constraint cannot be
-- validated on an existing database.
UPDATE jobs
SET booking_id = NULL
WHERE booking_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = jobs.booking_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_booking_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_booking_id ON jobs (booking_id)
  WHERE booking_id IS NOT NULL;

-- ── BOOK-28: per-tenant concurrent booking capacity ─────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS booking_slot_capacity INTEGER NOT NULL DEFAULT 1;

-- ── BOOK-06 backfill: converted_to_job_id was never written ─────────────────
-- The column has been permanently NULL since the feature shipped; the link only
-- ever existed on jobs.booking_id. Populate it so the detail sheet can gate the
-- "Convert to Job" button on a real value.
UPDATE bookings b
SET converted_to_job_id = j.id
FROM jobs j
WHERE j.booking_id = b.id
  AND j.tenant_id = b.tenant_id
  AND b.converted_to_job_id IS NULL;
