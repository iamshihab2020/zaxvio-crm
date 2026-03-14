-- =============================================================================
-- updated_at trigger and auto-numbering triggers
-- Hand-written (Drizzle does not support triggers).
-- All SQL is idempotent — safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1. updated_at trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have an updated_at column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'tenants', 'tenant_subscriptions', 'customers',
      'equipment', 'maintenance_contracts', 'bookings',
      'jobs', 'invoices', 'quotes'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || tbl || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 2. Auto-numbering trigger functions
-- =============================================================================

-- Job number: JOB-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_jobs_auto_number') THEN
    CREATE TRIGGER trg_jobs_auto_number
      BEFORE INSERT ON jobs
      FOR EACH ROW
      EXECUTE FUNCTION generate_job_number();
  END IF;
END $$;

-- Invoice number: INV-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoices_auto_number') THEN
    CREATE TRIGGER trg_invoices_auto_number
      BEFORE INSERT ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION generate_invoice_number();
  END IF;
END $$;

-- Quote number: QT-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quotes_auto_number') THEN
    CREATE TRIGGER trg_quotes_auto_number
      BEFORE INSERT ON quotes
      FOR EACH ROW
      EXECUTE FUNCTION generate_quote_number();
  END IF;
END $$;
