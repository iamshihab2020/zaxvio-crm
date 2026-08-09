-- ============================================================================
-- Customer email opt-out (DF-NOT-01)
--
-- A customer had no way to stop receiving email and the product had no way to
-- record that they had asked: no column, no token, no route, no footer link and
-- no suppression check in front of any send.
--
-- Today's exposure is defensible but not zero — most sends are transactional
-- (a quote you requested, an invoice you owe). E-12 review requests and E-09
-- renewal reminders are neither: they are automated commercial mail on a cron,
-- and they are exactly the two a recipient would most want to stop.
--
-- Workflow automation turns that from borderline into indefensible. The point
-- of the feature is unattended multi-step sequences, and one angry recipient
-- with no unsubscribe link is a deliverability problem for EVERY tenant on the
-- shared sending domain, because complaints score against the domain rather
-- than the sender.
--
-- Two columns, one partial index. No token column: the unsubscribe token is
-- DERIVED (HMAC of the customer id under BETTER_AUTH_SECRET), so there is
-- nothing to store, nothing to backfill, nothing to leak in a table dump, and
-- rotating the secret invalidates every outstanding link at once.
--
-- Idempotent throughout ([[strict-rules]] §1).
-- ============================================================================

-- ── customers.email_opt_out_at ──────────────────────────────────────────────
-- A nullable TIMESTAMPTZ, deliberately not a boolean. "When and how did they
-- opt out" is the question support gets asked, and a boolean cannot answer it.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_opt_out_at TIMESTAMPTZ;

-- How it happened: 'unsubscribe_link' | 'manual' | 'complaint' | 'import'.
-- Text rather than an enum — the set will grow (a provider webhook, a support
-- action) and an enum change is a migration for a field nothing branches on.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_opt_out_source TEXT;

COMMENT ON COLUMN customers.email_opt_out_at IS
  'When this customer asked to stop receiving non-transactional email. NULL means they have not. Consent is per (tenant, customer): one person may be reachable by tenant A and not tenant B.';
COMMENT ON COLUMN customers.email_opt_out_source IS
  'How the opt-out was recorded: unsubscribe_link, manual, complaint, import.';

-- ── the index ───────────────────────────────────────────────────────────────
-- Partial, on the opted-out rows only. The question asked of this column is
-- always "who can I no longer reach" — a handful of rows out of thousands. A
-- full index on a mostly-NULL column would be almost entirely dead weight.
CREATE INDEX IF NOT EXISTS idx_customers_opted_out
  ON customers (tenant_id, email_opt_out_at)
  WHERE email_opt_out_at IS NOT NULL;
