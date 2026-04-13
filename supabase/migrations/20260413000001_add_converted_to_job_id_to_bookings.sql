-- Add converted_to_job_id column to bookings table
-- Tracks which job a booking was converted into
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "converted_to_job_id" uuid;

-- Add FK constraint (guarded for idempotency)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_converted_to_job_id_jobs_id_fk') THEN
        ALTER TABLE "bookings" ADD CONSTRAINT "bookings_converted_to_job_id_jobs_id_fk"
            FOREIGN KEY ("converted_to_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL;
    END IF;
END $$;
