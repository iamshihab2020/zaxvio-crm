/**
 * Invoice business logic — totals, payments and the writes that move money.
 *
 * [[api-rules]] §1 says route handlers must be thin: validate, call a service,
 * respond. `routes/invoices/index.ts` was 1,639 lines with all SQL, money
 * maths, email dispatch and status logic inline, and the duplicate-invoice
 * check was written out twice (INV-31). Everything that decides a number lives
 * here now, so there is one copy to get right.
 *
 * The other reason this file exists: **transactions**. Recording a payment was
 * three unsynchronised statements — INSERT payment, SELECT SUM, UPDATE invoice
 * — so two payments posted concurrently both read a sum and the later UPDATE
 * won with whatever it saw, and a failure between the insert and the update
 * left a payment row the invoice did not know about. Deleting a payment had the
 * identical shape (INV-04 / DF-INV-02).
 */

import {
  getDb,
  invoices,
  invoiceLineItems,
  invoicePayments,
  jobLineItems,
  and,
  eq,
  sql,
  asc,
} from "@hvac-saas/database";
import {
  deriveStatus,
  splitPayment,
  round2,
  type InvoiceStatus,
} from "./status.service.js";
import {
  emitInvoicePaidIfSettled,
  emitPaymentRecorded,
} from "./invoice-events.service.js";

type Db = ReturnType<typeof getDb>;
/** Either the pooled client or an open transaction — every helper accepts both. */
type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  creditAmount: number;
  status: InvoiceStatus;
}

/**
 * Recompute every derived money column **and the status** from the line items
 * and payments that actually exist.
 *
 * The status half is INV-02. The old function recomputed `subtotal`,
 * `taxAmount`, `totalAmount` and `balanceDue` and never touched `status`, so an
 * invoice that took a payment and was then edited upward read **Paid** on the
 * list, in the stat cards, on the PDF and to every consumer of `status` while
 * money was still owed.
 */
export async function recalculateInvoice(
  tx: Executor,
  invoiceId: string,
  tenantId: string,
  /**
   * Who caused the recalculation, for the workflow event. Optional because most
   * callers are internal (a line-item write, a payment) and threading a user id
   * through every one of them would be a wide change for a field that is null
   * on the public paths anyway.
   */
  context?: { actorUserId: string | null },
): Promise<InvoiceTotals> {
  const [[sums], [inv]] = await Promise.all([
    tx
      .select({
        subtotal: sql<string>`COALESCE(SUM(${invoiceLineItems.quantity} * ${invoiceLineItems.unitPrice}), 0)`,
      })
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          eq(invoiceLineItems.tenantId, tenantId),
        ),
      ),
    tx
      .select({
        taxRate: invoices.taxRate,
        discountAmount: invoices.discountAmount,
        status: invoices.status,
      })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))),
  ]);

  if (!inv) {
    throw new Error(`Invoice ${invoiceId} not found while recalculating`);
  }

  // amountPaid is read from the payment rows, never from the stored column —
  // that column is what drifted.
  const amountPaid = await sumPayments(tx, invoiceId, tenantId);

  const subtotal = round2(parseFloat(sums?.subtotal ?? "0"));
  const taxRate = parseFloat(inv.taxRate ?? "0");
  const discountAmount = parseFloat(inv.discountAmount ?? "0");
  const taxAmount = round2(subtotal * taxRate);
  const totalAmount = round2(subtotal + taxAmount - discountAmount);

  const { balanceDue, creditAmount } = splitPayment({ totalAmount, amountPaid });
  const status = deriveStatus({
    current: inv.status as InvoiceStatus,
    totalAmount,
    amountPaid,
  });

  await tx
    .update(invoices)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      creditAmount: creditAmount.toFixed(2),
      status,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  // The one place `invoice.paid` can be emitted from, because this is the one
  // place the derived status is written. Emitting from a route would mean the
  // event agreed with whichever handler remembered to send it, which is the
  // assignment model this function replaced.
  await emitInvoicePaidIfSettled(tx, {
    tenantId,
    invoiceId,
    previousStatus: inv.status as InvoiceStatus,
    newStatus: status,
    creditAmount,
    actorUserId: context?.actorUserId ?? null,
  });

  return {
    subtotal,
    taxAmount,
    totalAmount,
    amountPaid,
    balanceDue,
    creditAmount,
    status,
  };
}

/** Sum of every recorded payment, straight from the rows. */
export async function sumPayments(
  tx: Executor,
  invoiceId: string,
  tenantId: string,
): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${invoicePayments.amount}), 0)` })
    .from(invoicePayments)
    .where(
      and(
        eq(invoicePayments.invoiceId, invoiceId),
        eq(invoicePayments.tenantId, tenantId),
      ),
    );
  return round2(parseFloat(row?.total ?? "0"));
}

export interface RecordPaymentInput {
  amount: string;
  paymentMethod?: "cash" | "check" | "credit_card" | "bank_transfer" | "other";
  paymentDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface PaymentResult {
  payment: typeof invoicePayments.$inferSelect;
  totals: InvoiceTotals;
  previousStatus: InvoiceStatus;
}

/**
 * Record a payment: insert the row, re-derive every total from the rows, write
 * them back — all inside one transaction with the invoice row locked.
 *
 * `SELECT … FOR UPDATE` is what makes concurrent payments correct. Without it
 * two requests both read `amountPaid = 0` and the second overwrites the first,
 * so a customer who paid twice shows one payment's worth of `amountPaid`
 * against two payment rows.
 */
export async function recordPayment(
  db: Db,
  params: {
    tenantId: string;
    invoiceId: string;
    input: RecordPaymentInput;
    /** Who recorded it. Null on any path with no session. */
    actorUserId?: string | null;
  },
): Promise<PaymentResult> {
  const { tenantId, invoiceId, input } = params;

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .for("update");

    if (!locked) throw new InvoiceNotFoundError(invoiceId);

    const [payment] = await tx
      .insert(invoicePayments)
      .values({
        tenantId,
        invoiceId,
        amount: input.amount,
        paymentMethod: input.paymentMethod ?? null,
        paymentDate: input.paymentDate,
        referenceNumber: input.referenceNumber ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    const totals = await recalculateInvoice(tx, invoiceId, tenantId, {
      actorUserId: params.actorUserId ?? null,
    });

    // After the recalculation, so `settlesInvoice` reflects the balance this
    // payment actually produced rather than the one it was expected to.
    await emitPaymentRecorded(tx, {
      tenantId,
      invoiceId,
      payment: {
        id: payment.id,
        amount: payment.amount,
        method: payment.paymentMethod,
        date: payment.paymentDate,
      },
      settlesInvoice: totals.balanceDue <= 0,
      actorUserId: params.actorUserId ?? null,
    });

    return {
      payment,
      totals,
      previousStatus: locked.status as InvoiceStatus,
    };
  });
}

/**
 * Delete a payment and reverse its effect.
 *
 * The old handler had no status guard and set `newStatus = "sent"` whenever
 * `amountPaid <= 0`, so deleting the last payment from a **voided** invoice
 * resurrected it into the overdue cron, the aging widget and the outstanding
 * total; deleting it from a **draft** marked the draft as sent although nothing
 * was ever sent and no PDF existed. The only guard on this financial reversal
 * lived in the browser — `invoice-payments-tab.tsx` hid the button for void
 * invoices (INV-03 / DF-INV-03). The status the invoice lands in is now
 * derived, so neither outcome is expressible.
 */
export async function deletePayment(
  db: Db,
  params: { tenantId: string; invoiceId: string; paymentId: string },
): Promise<InvoiceTotals> {
  const { tenantId, invoiceId, paymentId } = params;

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .for("update");

    if (!locked) throw new InvoiceNotFoundError(invoiceId);

    const deleted = await tx
      .delete(invoicePayments)
      .where(
        and(
          eq(invoicePayments.id, paymentId),
          eq(invoicePayments.invoiceId, invoiceId),
          eq(invoicePayments.tenantId, tenantId),
        ),
      )
      .returning({ id: invoicePayments.id });

    if (deleted.length === 0) throw new PaymentNotFoundError(paymentId);

    return recalculateInvoice(tx, invoiceId, tenantId);
  });
}

/**
 * Copy a job's line items onto an invoice. Shared by `POST /invoices` (with a
 * `jobId`) and `POST /invoices/from-job/:jobId`, which had two copies of this
 * and of the duplicate-invoice check.
 */
export async function copyJobLineItems(
  tx: Executor,
  params: { tenantId: string; invoiceId: string; jobId: string },
): Promise<number> {
  const { tenantId, invoiceId, jobId } = params;

  const jobItems = await tx
    .select()
    .from(jobLineItems)
    .where(
      and(eq(jobLineItems.tenantId, tenantId), eq(jobLineItems.jobId, jobId)),
    )
    .orderBy(asc(jobLineItems.sortOrder));

  if (jobItems.length === 0) return 0;

  await tx.insert(invoiceLineItems).values(
    jobItems.map((item) => ({
      tenantId,
      invoiceId,
      catalogItemId: item.catalogItemId,
      itemType: item.itemType,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: item.sortOrder ?? 0,
    })),
  );

  return jobItems.length;
}

/**
 * The active (non-void) invoice already raised against a job, if any. One
 * definition, used by both creation paths.
 */
export async function findActiveInvoiceForJob(
  tx: Executor,
  tenantId: string,
  jobId: string,
): Promise<{ id: string; invoiceNumber: string } | null> {
  const [existing] = await tx
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.jobId, jobId),
        sql`${invoices.status} != 'void'`,
      ),
    );
  return existing ?? null;
}

export class InvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} not found`);
    this.name = "InvoiceNotFoundError";
  }
}

export class PaymentNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment ${id} not found`);
    this.name = "PaymentNotFoundError";
  }
}
