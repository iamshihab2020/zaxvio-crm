/**
 * Workflow events for invoices.
 *
 * The interesting one is `invoice.paid`, and where it fires from is the whole
 * point: `recalculateInvoice()`, which **derives** status from the payment rows
 * rather than assigning it.
 *
 * Status used to be assignable, and INV-01/02/03 are what that cost — an
 * invoice that took a payment and was then edited upward read **Paid** on the
 * list, in the stat cards and on the PDF while money was still owed. An
 * automation firing on that would have thanked a customer who had not paid, and
 * stopped chasing one who still owed.
 *
 * Deriving it also makes the event fire on the cases an assignment model cannot
 * express: a payment deleted from a paid invoice re-derives to
 * `partially_paid`, so the next payment that settles it fires `invoice.paid`
 * again — correctly, because it became paid again.
 */

import {
  customers,
  invoices,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import type { InvoiceStatus } from "./status.service.js";
import {
  invoiceCreated,
  invoicePaid,
  invoicePaymentRecorded,
  invoiceSent,
  invoiceVoided,
  type CustomerArgs,
  type InvoiceArgs,
} from "../workflow/events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/** The invoice and its customer, in the shape the producers want. */
interface InvoiceContext {
  invoice: InvoiceArgs;
  customer: CustomerArgs;
}

/**
 * Read the invoice **after** the recalculation, joined to its customer.
 *
 * Tenant-scoped on both sides. The join carries a tenant predicate as well as
 * the FK, which is the pattern the conversations audit established after a
 * customer join with no tenant predicate turned an unchecked id into a name,
 * email and phone number from another tenant.
 */
async function loadInvoiceContext(
  db: Db,
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceContext | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      totalAmount: invoices.totalAmount,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue,
      issuedDate: invoices.issuedDate,
      dueDate: invoices.dueDate,
      jobId: invoices.jobId,
      customerId: customers.id,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
    })
    .from(invoices)
    .innerJoin(
      customers,
      and(eq(invoices.customerId, customers.id), eq(customers.tenantId, tenantId)),
    )
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)));

  if (!row) return null;

  return {
    invoice: {
      id: row.id,
      invoiceNumber: row.invoiceNumber ?? "",
      status: row.status as InvoiceStatus,
      totalAmount: row.totalAmount,
      amountPaid: row.amountPaid,
      balanceDue: row.balanceDue,
      issuedDate: row.issuedDate,
      dueDate: row.dueDate,
      jobId: row.jobId,
    },
    customer: {
      id: row.customerId,
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      email: row.customerEmail,
      phone: row.customerPhone,
    },
  };
}

/** Where the invoice came from. `job` covers `POST /invoices/from-job`. */
export type InvoiceOrigin = "manual" | "job" | "api";

/**
 * Emit `invoice.created`.
 *
 * Called after the line items and the recalculation, never straight after the
 * `INSERT` — an invoice row starts at zero and a workflow gating on "over
 * $2,000" would otherwise never match one. This is the same ordering rule the
 * quote creator follows, for the same reason.
 */
export async function emitInvoiceCreatedEvent(
  db: Db,
  args: {
    tenantId: string;
    invoiceId: string;
    origin: InvoiceOrigin;
    actorUserId: string | null;
  },
): Promise<void> {
  const context = await loadInvoiceContext(db, args.tenantId, args.invoiceId);
  if (!context) return;

  const [row] = await db
    .select({ createdAt: invoices.createdAt })
    .from(invoices)
    .where(
      and(eq(invoices.tenantId, args.tenantId), eq(invoices.id, args.invoiceId)),
    );

  await invoiceCreated(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    invoice: {
      id: context.invoice.id,
      invoiceNumber: context.invoice.invoiceNumber,
      status: context.invoice.status,
      totalAmount: context.invoice.totalAmount,
      amountPaid: context.invoice.amountPaid,
      balanceDue: context.invoice.balanceDue,
      issuedDate: context.invoice.issuedDate,
      dueDate: context.invoice.dueDate,
      jobId: context.invoice.jobId,
      createdAt: row?.createdAt ?? new Date(),
    },
    customer: context.customer,
    origin: args.origin,
  });
}

export interface InvoiceStatusTransition {
  invoiceId: string;
  from: InvoiceStatus;
  to: InvoiceStatus;
}

/**
 * Emit the events a **status** change implies — `invoice.sent`, `invoice.voided`.
 *
 * One emitter for **four** call sites: `POST /:id/send`, `POST /:id/void`,
 * `PATCH /:id/status` and `POST /bulk-status-update`. Three of those can void an
 * invoice and two can send one, and JOB-22 is the record of what happens when
 * each writes its own side effects — the bulk path silently skipped the
 * completion email the single path sent, and nobody noticed until an audit.
 *
 * Only real crossings emit. `from === to` is filtered out, so re-sending an
 * invoice a customer says never arrived does not restart a payment-chasing
 * sequence from day one, and voiding twice announces it once.
 *
 * `paid` and `partially_paid` are absent on purpose: those are **derived** from
 * the payment rows by `recalculateInvoice`, which emits `invoice.paid` itself.
 * Emitting them here as well would double-fire on the one status this system
 * deliberately refuses to let anyone assign (INV-01/02/03).
 */
export async function emitInvoiceStatusEvents(
  db: Db,
  args: {
    tenantId: string;
    actorUserId: string | null;
    transitions: InvoiceStatusTransition[];
  },
): Promise<void> {
  const real = args.transitions.filter((t) => t.from !== t.to);
  if (real.length === 0) return;

  for (const transition of real) {
    if (transition.to !== "sent" && transition.to !== "void") continue;

    const context = await loadInvoiceContext(
      db,
      args.tenantId,
      transition.invoiceId,
    );
    if (!context) continue;

    if (transition.to === "sent") {
      await invoiceSent(db, {
        tenantId: args.tenantId,
        actorUserId: args.actorUserId,
        invoice: context.invoice,
        customer: context.customer,
        sentAt: new Date(),
      });
      continue;
    }

    await invoiceVoided(db, {
      tenantId: args.tenantId,
      actorUserId: args.actorUserId,
      invoice: context.invoice,
      customer: context.customer,
      voidedAt: new Date(),
    });
  }
}

/**
 * Emit `invoice.paid` when the derived status crossed **into** `paid`.
 *
 * The transition check is what stops it firing on every subsequent edit of an
 * already-paid invoice. Called from inside `recalculateInvoice`'s transaction,
 * so the event and the derived status commit together.
 */
export async function emitInvoicePaidIfSettled(
  db: Db,
  args: {
    tenantId: string;
    invoiceId: string;
    previousStatus: InvoiceStatus;
    newStatus: InvoiceStatus;
    creditAmount: number;
    actorUserId: string | null;
  },
): Promise<void> {
  if (args.newStatus !== "paid" || args.previousStatus === "paid") return;

  const context = await loadInvoiceContext(db, args.tenantId, args.invoiceId);
  // An invoice with no customer row cannot happen — `customer_id` is NOT NULL —
  // but a recalculation racing a delete can. Nothing to enrol either way.
  if (!context) return;

  await invoicePaid(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    invoice: context.invoice,
    customer: context.customer,
    creditAmount: args.creditAmount,
    paidAt: new Date(),
  });
}

/**
 * Emit `invoice.payment_recorded` for every payment, settling or not.
 *
 * Two events rather than one because they answer different questions: "log the
 * deposit" wants every payment, "stop chasing them" wants only the last.
 */
export async function emitPaymentRecorded(
  db: Db,
  args: {
    tenantId: string;
    invoiceId: string;
    payment: {
      id: string;
      amount: string;
      method:
        | "cash"
        | "check"
        | "credit_card"
        | "bank_transfer"
        | "other"
        | null;
      date: string;
    };
    settlesInvoice: boolean;
    actorUserId: string | null;
  },
): Promise<void> {
  const context = await loadInvoiceContext(db, args.tenantId, args.invoiceId);
  if (!context) return;

  await invoicePaymentRecorded(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    invoice: context.invoice,
    customer: context.customer,
    payment: args.payment,
    settlesInvoice: args.settlesInvoice,
  });
}
