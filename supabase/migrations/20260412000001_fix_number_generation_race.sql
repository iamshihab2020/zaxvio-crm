-- Fix race condition in auto-numbering trigger functions.
-- Uses pg_advisory_xact_lock to serialize number generation per tenant.
-- Lock key: hashtext(tenant_id) + discriminator (1=job, 2=invoice, 3=quote).
-- CREATE OR REPLACE FUNCTION is idempotent — safe to re-run.

-- Job number: JOB-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    -- Acquire tenant-scoped advisory lock to prevent concurrent duplicate numbers
    PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text), 1);

    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(job_number FROM 'JOB-\d{4}-(\d+)') AS INT)), 0
    ) + 1
    INTO next_seq
    FROM jobs
    WHERE tenant_id = NEW.tenant_id
      AND job_number LIKE 'JOB-' || current_year || '-%';
    NEW.job_number := 'JOB-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Invoice number: INV-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    -- Acquire tenant-scoped advisory lock to prevent concurrent duplicate numbers
    PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text), 2);

    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(invoice_number FROM 'INV-\d{4}-(\d+)') AS INT)), 0
    ) + 1
    INTO next_seq
    FROM invoices
    WHERE tenant_id = NEW.tenant_id
      AND invoice_number LIKE 'INV-' || current_year || '-%';
    NEW.invoice_number := 'INV-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Quote number: QT-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    -- Acquire tenant-scoped advisory lock to prevent concurrent duplicate numbers
    PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text), 3);

    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(quote_number FROM 'QT-\d{4}-(\d+)') AS INT)), 0
    ) + 1
    INTO next_seq
    FROM quotes
    WHERE tenant_id = NEW.tenant_id
      AND quote_number LIKE 'QT-' || current_year || '-%';
    NEW.quote_number := 'QT-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
