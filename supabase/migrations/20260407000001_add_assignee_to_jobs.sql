-- Add assignee_id column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assignee_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_assignee_id ON jobs(assignee_id);
