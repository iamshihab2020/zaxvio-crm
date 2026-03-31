-- Add equipment_id column to jobs table for asset-centric service tracking

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_equipment_id ON jobs(equipment_id);
