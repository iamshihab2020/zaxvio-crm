-- Fix refrigerant_logs.job_id: make nullable and add FK constraint
-- Previously job_id was NOT NULL with no FK reference

-- Drop NOT NULL constraint (idempotent — safe to run if already nullable)
ALTER TABLE refrigerant_logs ALTER COLUMN job_id DROP NOT NULL;

-- Add FK constraint if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refrigerant_logs_job_id_jobs_id_fk'
    ) THEN
        ALTER TABLE refrigerant_logs
        ADD CONSTRAINT refrigerant_logs_job_id_jobs_id_fk
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
    END IF;
END $$;
