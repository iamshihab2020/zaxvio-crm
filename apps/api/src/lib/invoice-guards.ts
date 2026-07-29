/**
 * Preconditions every mutating invoice handler shares.
 *
 * The jobs audit wrote `lib/job-guards.ts` for exactly this and it took the
 * archived check from 4 of 14 handlers to all of them. It never propagated:
 * **no** mutating handler in `routes/invoices/index.ts` checked `archivedAt`,
 * so archiving — the product's "make this go away" action — stopped nothing.
 * You could record a payment on an archived invoice, void it, edit its line
 * items and send it to the customer (INV-01).
 *
 * Same shape as `job-guards.ts` on purpose: two lines at the top of a handler,
 * one import, no way to half-apply it.
 */

import {
  getDb,
  invoices,
  customers,
  jobs,
  catalogItems,
  and,
  eq,
} from "@hvac-saas/database";
import type { InvoiceStatus } from "../services/invoices/status.service.js";
import {
  PAYABLE_STATUSES,
  label,
} from "../services/invoices/status.service.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface GuardedInvoice {
  id: string;
  tenantId: string;
  customerId: string;
  jobId: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  creditAmount: string;
  dueDate: string | null;
  issuedDate: string;
  reviewRequestedAt: Date | null;
  pdfStoragePath: string | null;
  archivedAt: Date | null;
}

export type InvoiceGuard =
  | { ok: true; invoice: GuardedInvoice }
  | { ok: false; status: 404 | 400; message: string };

const GUARD_COLUMNS = {
  id: invoices.id,
  tenantId: invoices.tenantId,
  customerId: invoices.customerId,
  jobId: invoices.jobId,
  invoiceNumber: invoices.invoiceNumber,
  status: invoices.status,
  totalAmount: invoices.totalAmount,
  amountPaid: invoices.amountPaid,
  balanceDue: invoices.balanceDue,
  creditAmount: invoices.creditAmount,
  dueDate: invoices.dueDate,
  issuedDate: invoices.issuedDate,
  reviewRequestedAt: invoices.reviewRequestedAt,
  pdfStoragePath: invoices.pdfStoragePath,
  archivedAt: invoices.archivedAt,
};

/**
 * Load an invoice for mutation: it must exist, belong to this tenant, and not
 * be archived.
 *
 * Usage:
 *   const guard = await loadEditableInvoice(db, tenantId, id);
 *   if (!guard.ok) return reply.status(guard.status).send({ message: guard.message });
 */
export async function loadEditableInvoice(
  db: Db,
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceGuard> {
  const [invoice] = await db
    .select(GUARD_COLUMNS)
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)));

  const gate = assertEditable(invoice as GuardedInvoice | undefined);
  return gate ?? { ok: true, invoice: invoice as GuardedInvoice };
}

/** The refusal, or null when the invoice may be modified. */
export function assertEditable(
  invoice: { archivedAt: Date | null } | undefined,
): { ok: false; status: 404 | 400; message: string } | null {
  if (!invoice) return { ok: false, status: 404, message: "Invoice not found" };
  if (invoice.archivedAt) {
    return {
      ok: false,
      status: 400,
      message: "Cannot modify an archived invoice. Restore it first.",
    };
  }
  return null;
}

/**
 * The extra gate on anything that touches money.
 *
 * A **draft** invoice — one the customer has never seen — used to accept a
 * payment, flip to `paid`, fire the `invoice_paid` notification and email an
 * E-08 receipt for a document that was never sent. The only status checked was
 * `void` (INV-01).
 */
export function assertPayable(
  invoice: { status: InvoiceStatus },
): { ok: false; status: 400; message: string } | null {
  if (PAYABLE_STATUSES.includes(invoice.status)) return null;
  if (invoice.status === "draft") {
    return {
      ok: false,
      status: 400,
      message: "Send the invoice before recording a payment against it.",
    };
  }
  if (invoice.status === "paid") {
    return {
      ok: false,
      status: 400,
      message: "This invoice is already paid in full.",
    };
  }
  return {
    ok: false,
    status: 400,
    message: `Cannot record a payment on a ${label(invoice.status)} invoice`,
  };
}

/**
 * Only draft invoices may be structurally edited — line items, tax rate,
 * discount, customer. Kept here so the message exists in one place instead of
 * the five copies the route file had.
 */
export function assertDraft(
  invoice: { status: InvoiceStatus },
  action: string,
): { ok: false; status: 400; message: string } | null {
  if (invoice.status === "draft") return null;
  return {
    ok: false,
    status: 400,
    message: `Only draft invoices can be ${action}`,
  };
}

/**
 * Tenant-ownership checks for the foreign keys a request supplies.
 *
 * `findForeignRef` in `job-guards.ts` was written in July for this exact class
 * and never reached invoices: `POST /invoices` validated that `body.jobId`
 * belonged to the tenant but never that the job belonged to the *customer being
 * billed*, so a mis-set `jobId` billed customer A for customer B's work and
 * copied B's line items — and therefore B's money — onto A's invoice (INV-09).
 */
async function owns(
  db: Db,
  tenantId: string,
  id: string,
  table: typeof customers | typeof catalogItems,
): Promise<boolean> {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.tenantId, tenantId), eq(table.id, id)));
  return Boolean(row);
}

export const ownsCustomer = (db: Db, tenantId: string, id: string) =>
  owns(db, tenantId, id, customers);
export const ownsCatalogItem = (db: Db, tenantId: string, id: string) =>
  owns(db, tenantId, id, catalogItems);

export interface OwnedJob {
  id: string;
  customerId: string;
  taxRate: string | null;
}

/**
 * Load a job that belongs to this tenant *and* to the customer being billed.
 * Returns a refusal rather than a boolean so the caller cannot forget the
 * second half of the check.
 */
export async function loadBillableJob(
  db: Db,
  tenantId: string,
  jobId: string,
  customerId: string | null,
): Promise<
  { ok: true; job: OwnedJob } | { ok: false; status: 400; message: string }
> {
  const [job] = await db
    .select({
      id: jobs.id,
      customerId: jobs.customerId,
      taxRate: jobs.taxRate,
    })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));

  if (!job) {
    return { ok: false, status: 400, message: "Job not found" };
  }
  if (customerId && job.customerId !== customerId) {
    return {
      ok: false,
      status: 400,
      message: "That job belongs to a different customer",
    };
  }
  return { ok: true, job };
}
