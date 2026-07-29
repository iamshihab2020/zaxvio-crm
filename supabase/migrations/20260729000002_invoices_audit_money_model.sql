-- Invoices audit remediation — the money model (INV-02, 29, 33) and the two
-- columns the new status service needs.
--
-- INV-02: `recalculateInvoiceTotals` clamped `balance_due` with `Math.max(0, …)`
--         at three sites, so an overpayment was silently destroyed — no credit,
--         no refund record, no audit trail (DF-INV-01, open since 2026-04-12).
--         `credit_amount` gives the overpayment somewhere to live, so the
--         balance can stay 0 without the money disappearing.
--
-- INV-29: E-12 review requests lived in a 2-hour in-memory `setTimeout`. Any
--         deploy, crash or scale event dropped every pending one, silently
--         (DF-INV-04). `review_email_scheduled_at` moves the intent into the
--         row, so the cron next door can pick it up after a restart.
--
-- INV-33: `invoices` had exactly two indexes — (tenant_id, invoice_number) and
--         (tenant_id, status). Nothing on customer_id, job_id or due_date, all
--         of which the list endpoint filters on. Worse, `invoice_line_items`
--         and `invoice_payments` had **no index on invoice_id at all**, so
--         every detail fetch and every total recalculation was a sequential
--         scan of the whole tenant-shared table.
--
-- Idempotent per strict-rules §1.

-- ── INV-02: overpayment becomes a credit instead of vanishing ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'credit_amount'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN credit_amount numeric(10, 2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill the credits the clamp already destroyed, where they are still
-- recoverable: amount_paid above total_amount is an overpayment by definition.
UPDATE invoices
SET credit_amount = ROUND(amount_paid - total_amount, 2)
WHERE amount_paid > total_amount
  AND credit_amount = 0;

-- ── INV-29: durable E-12 scheduling ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'review_email_scheduled_at'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN review_email_scheduled_at timestamptz;
  END IF;
END $$;

-- ── INV-33: the indexes every hot path was missing ─────────────────────────
-- List filters (`?customerId=`, `?jobId=`) and the customer overview's
-- outstanding-invoice query.
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer
  ON invoices (tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_job
  ON invoices (tenant_id, job_id)
  WHERE job_id IS NOT NULL;

-- The derived `overdue` predicate: status NOT IN ('paid','void') AND due_date <
-- today. Partial on archived_at because every read path filters it.
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due_date
  ON invoices (tenant_id, due_date)
  WHERE archived_at IS NULL;

-- The overdue cron scans across tenants, so it needs a non-tenant-leading index.
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date
  ON invoices (status, due_date)
  WHERE archived_at IS NULL AND due_date IS NOT NULL;

-- Every detail fetch and every recalculation reads these by invoice_id.
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
  ON invoice_line_items (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON invoice_payments (invoice_id);

-- ── Consistency repair for rows written before the status service ──────────
-- INV-01/02 let a draft take a payment and flip to `paid`, and let
-- `PATCH /:id/status` write `paid` with no payment rows at all. Re-derive the
-- stored status from the money for every non-void invoice, so the list, the
-- stat cards and the PDF stop disagreeing with the payments table.
UPDATE invoices
SET status = CASE
      -- Nothing paid: a document that was never sent stays a draft; anything
      -- else falls back to 'sent'. `overdue` is derived from due_date at read
      -- time, so it is never stored by this repair.
      WHEN amount_paid <= 0 THEN
        CASE WHEN status = 'draft' THEN 'draft'::invoice_status ELSE 'sent'::invoice_status END
      WHEN amount_paid >= total_amount THEN 'paid'::invoice_status
      ELSE 'partially_paid'::invoice_status
    END
WHERE status <> 'void'
  AND status <> CASE
      WHEN amount_paid <= 0 THEN
        CASE WHEN status = 'draft' THEN 'draft'::invoice_status ELSE 'sent'::invoice_status END
      WHEN amount_paid >= total_amount THEN 'paid'::invoice_status
      ELSE 'partially_paid'::invoice_status
    END;

-- The same clamp that destroyed credits also left balance_due wrong on any
-- invoice edited after a payment. Recompute it from the two columns it derives
-- from, and let it go negative only through credit_amount (never below 0).
UPDATE invoices
SET balance_due = GREATEST(0, ROUND(total_amount - amount_paid, 2))
WHERE balance_due <> GREATEST(0, ROUND(total_amount - amount_paid, 2));
