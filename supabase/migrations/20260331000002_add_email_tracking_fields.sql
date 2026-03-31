-- Email idempotency tracking fields for cron-triggered emails
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS)

-- E-07: Track when the last overdue reminder was sent per invoice
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_overdue_reminder_at TIMESTAMPTZ;

-- E-09: Track when the renewal reminder was sent per maintenance contract
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at TIMESTAMPTZ;

-- E-10: Track when the trial expiry email was sent per tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_expiry_email_sent_at TIMESTAMPTZ;
