# Deferred Fixes: Invoices

> **Last audited:** 2026-04-12
> **Flow:** Tenant → Invoice → Customer (creation, line items, send, PDF, email, status, cron)

---

## All five closed — 2026-07-29

Logged 2026-04-12, resolved as part of the [[reports/invoices|Invoices audit remediation]].
Per [[strict-rules]] §12 these were due when the payment feature went live, and it is
live; the audit found them still open nine weeks later, which is the reason §12 now
says to check this folder *before* building rather than after.

Kept here rather than moved to "Fixed Issues" because the original write-ups are the
clearest statement of each defect. Each now carries a **Resolution** line.

### DF-INV-01: Overpayment accepted without validation `FIXED`

- **Severity:** CRITICAL
- **File:** `apps/api/src/routes/invoices/index.ts` lines 790-836
- **Problem:** No check that `body.amount <= balanceDue`. User can record $10,000 payment on $100 invoice. Balance gets clamped to $0.00 via `Math.max(0, balanceDue)` on line 832 — the overpayment amount is silently lost with no audit trail.
- **Fix:** Add validation before insert:
  ```typescript
  const currentBalance = parseFloat(inv.balanceDue);
  if (parseFloat(body.amount) > currentBalance) {
    return reply.status(400).send({ 
      message: `Payment amount ($${body.amount}) exceeds balance due ($${currentBalance.toFixed(2)})` 
    });
  }
  ```
- **Alternative:** Allow overpayment but store it as a credit/refund field instead of clamping.
- **Resolution (2026-07-29):** Took the alternative. New `invoices.credit_amount` column; `splitPayment()` in `services/invoices/status.service.ts` puts the excess there instead of clamping, and it is shown on the Payments tab, in the summary and on the PDF. The UI warns before recording an amount above the balance, since it is usually a typo. Migration `20260729000002` backfills credits that were still recoverable from `amount_paid > total_amount`.

---

### DF-INV-02: No DB transaction on payment recording `FIXED`

- **Severity:** CRITICAL
- **File:** `apps/api/src/routes/invoices/index.ts` lines 790-836
- **Problem:** Three separate queries without transaction wrapping:
  1. `INSERT` payment (line 790)
  2. `SELECT SUM` all payments (line 804)
  3. `UPDATE` invoice totals/status (line 828)
  
  If UPDATE fails after INSERT, payment record exists but invoice totals are wrong. Concurrent payments can race and produce incorrect `amountPaid`.
- **Fix:** Wrap in `db.transaction()`:
  ```typescript
  await db.transaction(async (tx) => {
    await tx.insert(invoicePayments).values({ ... });
    const paymentSum = await tx.select({ ... }).from(invoicePayments).where(...);
    await tx.update(invoices).set({ ... }).where(...);
  });
  ```
- **Resolution (2026-07-29):** `recordPayment()` and `deletePayment()` in `services/invoices/invoices.service.ts` are each one transaction, and both take `SELECT … FOR UPDATE` on the invoice row first — the lock is what makes concurrent payments correct, not the transaction alone. `POST /invoices` and every line-item write are wrapped too, since they recalculate the same columns.

---

### DF-INV-03: Payment deletion skips void/status check `FIXED`

- **Severity:** CRITICAL
- **File:** `apps/api/src/routes/invoices/index.ts` lines 932-1008
- **Problem:** Payment recording blocks void invoices (line 784), but payment **deletion** does NOT check status. Deleting a payment from a void invoice resets its status to "sent" (line 989).
- **Fix:** Add status guard at top of delete handler:
  ```typescript
  const inv = await db.select({ status: invoices.status }).from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId))).then(r => r[0]);
  if (inv?.status === "void") {
    return reply.status(400).send({ message: "Cannot modify payments on a void invoice" });
  }
  ```
- **Resolution (2026-07-29):** The guard was added, but the real fix is that the resulting status is no longer *chosen*. `deriveStatus()` computes it from the payment rows, so "delete the last payment → set sent" is not expressible: a void invoice stays void and a draft stays a draft.

---

### DF-INV-04: Review request email uses setTimeout — lost on restart `FIXED`

- **Severity:** HIGH
- **File:** `apps/api/src/routes/invoices/index.ts` lines 887-920
- **Problem:** 2-hour delay for review request email (E-12) is an in-memory `setTimeout`. If the server restarts (deploy, crash, auto-scale), all pending review emails are silently lost. No retry mechanism.
- **Fix options:**
  1. **Simple:** Add a `reviewEmailScheduledAt` column. Cron job picks up invoices where `status = 'paid' AND reviewEmailScheduledAt IS NOT NULL AND reviewEmailScheduledAt < NOW() AND reviewRequestedAt IS NULL`.
  2. **Better:** Use a job queue (BullMQ, Inngest, or Vercel Queues) for delayed tasks.
- **Resolution (2026-07-29):** Took option 1. New `invoices.review_email_scheduled_at`; the payment handler writes it and `processReviewRequests()` in `lib/cron/email-cron.ts` sweeps every 15 minutes, claiming rows with one `UPDATE … RETURNING` so two API instances cannot both send.

---

### DF-INV-05: No payment delete confirmation in frontend `FIXED`

- **Severity:** MEDIUM
- **File:** `apps/web/src/components/dashboard/invoices/invoice-payments-tab.tsx` lines 104-112
- **Problem:** Payments are deleted immediately on click with no confirmation dialog. This reverses financial state (amountPaid, balanceDue, status). Delete button for line items has a confirmation dialog, but payments do not.
- **Fix:** Wrap in `DeleteConfirmDialog` or `ConfirmActionDialog`:
  ```tsx
  <ConfirmActionDialog
    title="Delete Payment"
    description={`Remove this $${amount} payment? This will update the invoice balance.`}
    onConfirm={() => handleDelete(payment.id)}
  />
  ```
- **Resolution (2026-07-29):** `ConfirmActionDialog`, naming the amount: *"Remove this $200.00 payment? The invoice balance and status will be recalculated."* Line-item deletion got one too — it had the same click-to-destroy shape.

---

## Fixed Issues

All five above, 2026-07-29. See [[reports/invoices]] §5 for the phase they landed in
and [[todo]] for the verification record.

**What made them findable again:** none of these were re-discovered by using the
product — they were re-discovered by a code-reading audit nine weeks later. The
process change is in [[strict-rules]] §12: check this folder *before* building a
feature, not after.
