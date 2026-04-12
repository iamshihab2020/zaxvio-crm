# Deferred Fixes: Invoices

> **Last audited:** 2026-04-12
> **Flow:** Tenant → Invoice → Customer (creation, line items, send, PDF, email, status, cron)

---

## Deferred Until: Payment Feature is Built

These issues exist in the codebase but only matter once payment recording is actively used by customers.

### DF-INV-01: Overpayment accepted without validation `DEFERRED`

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

---

### DF-INV-02: No DB transaction on payment recording `DEFERRED`

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

---

### DF-INV-03: Payment deletion skips void/status check `DEFERRED`

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

---

### DF-INV-04: Review request email uses setTimeout — lost on restart `DEFERRED`

- **Severity:** HIGH
- **File:** `apps/api/src/routes/invoices/index.ts` lines 887-920
- **Problem:** 2-hour delay for review request email (E-12) is an in-memory `setTimeout`. If the server restarts (deploy, crash, auto-scale), all pending review emails are silently lost. No retry mechanism.
- **Fix options:**
  1. **Simple:** Add a `reviewEmailScheduledAt` column. Cron job picks up invoices where `status = 'paid' AND reviewEmailScheduledAt IS NOT NULL AND reviewEmailScheduledAt < NOW() AND reviewRequestedAt IS NULL`.
  2. **Better:** Use a job queue (BullMQ, Inngest, or Vercel Queues) for delayed tasks.

---

### DF-INV-05: No payment delete confirmation in frontend `DEFERRED`

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

---

## Fixed Issues

_(Move resolved issues here with date and commit hash)_

<!-- Example:
### DF-INV-XX: Description `FIXED`
- **Fixed:** 2026-04-15, commit abc1234
- **What changed:** Brief description of the fix
-->
