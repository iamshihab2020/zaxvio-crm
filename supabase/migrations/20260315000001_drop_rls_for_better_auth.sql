-- =============================================================================
-- Drop RLS policies and disable RLS on all tenant tables.
-- Better Auth handles auth via application-level middleware,
-- and tenant isolation is enforced via WHERE clauses in queries.
-- All SQL is idempotent — safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1. Drop all tenant isolation policies
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
  pol_suffix TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'tenant_subscriptions', 'customers', 'catalog_items',
      'equipment', 'maintenance_contracts', 'bookings',
      'jobs', 'job_line_items', 'job_photos', 'job_checklist_completions',
      'invoices', 'invoice_line_items', 'invoice_payments',
      'quotes', 'quote_line_items', 'refrigerant_logs',
      'availability_schedules', 'schedule_overrides',
      'checklist_templates', 'checklist_items'
    ])
  LOOP
    FOR pol_suffix IN
      SELECT unnest(ARRAY['_tenant_select', '_tenant_insert', '_tenant_update', '_tenant_delete'])
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || pol_suffix, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Drop tenants table policies
DROP POLICY IF EXISTS tenants_tenant_select ON tenants;
DROP POLICY IF EXISTS tenants_tenant_update ON tenants;

-- Drop platform_events policies
DROP POLICY IF EXISTS platform_events_tenant_insert ON platform_events;

-- =============================================================================
-- 2. Disable RLS on all tables
-- =============================================================================
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklist_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE refrigerant_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_events DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Note: Trigger functions (updated_at, auto-numbering) are kept intact.
-- They are independent of RLS and still useful.
-- =============================================================================
