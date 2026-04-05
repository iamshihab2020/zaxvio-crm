-- Job Attachments: add tag/uploadedBy/fileSize to job_photos, create job_documents table

-- Create photo_tag enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_tag') THEN
    CREATE TYPE "photo_tag" AS ENUM ('before', 'after', 'general');
  END IF;
END $$;

-- Extend job_photos with tag, uploaded_by, file_size
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS tag photo_tag NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS uploaded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_size integer;

-- Create job_documents table
CREATE TABLE IF NOT EXISTS job_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id uuid,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_tenant_id ON job_documents(tenant_id);
