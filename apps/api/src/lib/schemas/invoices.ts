import { z } from "zod";
import { idParam, paginationQuery, isoDate, booleanFlag, lineItemDescription } from "./common.js";

// ── Shared primitives ─────────────────────────────────────────────────────────

/**
 * Dates here were bare `z.string().optional()`, which accepts `"infinity"`,
 * `"tomorrow"` and `""` — Postgres parses the first two into real dates. The
 * bookings audit added `isoDate` to `common.ts` for exactly this in April and
 * the money table was never migrated onto it.
 */
const dateString = isoDate;

/** A money amount as a string, because the columns are `numeric`. */
const moneyString = z
  .string()
  .regex(/^-?\d{1,8}(\.\d{1,2})?$/, "Must be a valid amount");

/** A positive money amount — what a payment must be. */
const positiveMoneyString = moneyString.refine(
  (v) => parseFloat(v) > 0,
  "Amount must be greater than zero",
);

/**
 * Tax rate as a **fraction** (0.0825 = 8.25%), which is how every reader treats
 * it. `tenants.defaultTaxRate` is validated `min(0).max(100)` while the UI
 * divides by 100 before sending, so that bound is in the wrong unit and permits
 * a 10,000% rate through the API (INV-40). Bounded correctly here.
 */
const taxRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Tax rate must be a fraction, e.g. 0.0825 for 8.25%")
  .refine((v) => parseFloat(v) >= 0 && parseFloat(v) <= 1, {
    message: "Tax rate must be between 0 and 1 (0% – 100%)",
  });

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

export const lineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const paymentParam = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
});

export const jobIdParam = z.object({
  jobId: z.string().uuid(),
});

// ── Querystrings ──────────────────────────────────────────────────────────────

export const invoiceListQuery = paginationQuery.extend({
  // `overdue` and `unpaid` are derived filters, not stored statuses — see
  // `services/invoices/status.service.ts`. `unpaid` means "money is still owed
  // on this": sent, overdue or partially paid. Added so the customer overview
  // can ask the database for the outstanding invoices instead of filtering a
  // page of 20 in the browser and calling the result a total (CUST-05).
  status: z
    .enum(["draft", "sent", "paid", "overdue", "void", "partially_paid", "unpaid"])
    .optional(),
  customerId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  sortBy: z
    .enum([
      "createdAt",
      "issuedDate",
      "dueDate",
      "invoiceNumber",
      "status",
      "totalAmount",
      "balanceDue",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * The stats endpoint took no querystring at all, so filtering the list to one
 * customer left the KPI cards counting the whole tenant (INV-23). Same filters
 * as the list, minus the ones that cannot change a count.
 */
export const invoiceStatsQuery = z.object({
  customerId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  showArchived: booleanFlag.default(false).optional(),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createInvoiceBody = z.object({
  customerId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  issuedDate: dateString.optional(),
  dueDate: dateString.optional(),
  taxRate: taxRateString.optional(),
  discountAmount: moneyString.optional(),
  notes: z.string().max(5000).optional(),
});

export const updateInvoiceBody = z.object({
  notes: z.string().max(5000).optional(),
  dueDate: dateString.nullable().optional(),
  taxRate: taxRateString.optional(),
  discountAmount: moneyString.optional(),
  customerId: z.string().uuid().optional(),
  issuedDate: dateString.optional(),
});

export const addLineItemBody = z.object({
  description: lineItemDescription,
  unitPrice: moneyString.optional(),
  itemType: z.enum(["labor", "part", "material", "service_call", "other"]).optional(),
  quantity: z
    .string()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Quantity must be a positive number")
    .optional(),
  catalogItemId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateLineItemBody = z.object({
  description: lineItemDescription,
  quantity: z
    .string()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Quantity must be a positive number")
    .optional(),
  unitPrice: moneyString.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  itemType: z.enum(["labor", "part", "material", "service_call", "other"]).optional(),
});

export const recordPaymentBody = z.object({
  amount: positiveMoneyString,
  paymentMethod: z
    .enum(["cash", "check", "credit_card", "bank_transfer", "other"])
    .optional(),
  paymentDate: dateString.optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * "The customer handed me a cheque" — the single most common action on an
 * invoice, which used to take five interactions (open row → Payments tab →
 * Record Payment → five-field form → save). The amount is the balance the
 * server reads under the row lock, so there is no stale-balance race.
 */
export const payInFullBody = z.object({
  paymentMethod: z
    .enum(["cash", "check", "credit_card", "bank_transfer", "other"])
    .optional(),
  paymentDate: dateString.optional(),
  referenceNumber: z.string().max(100).optional(),
});

/**
 * The status enum stays complete so the transition service can explain *why* a
 * particular move is refused. A Zod enum error would just say "invalid value".
 */
export const updateInvoiceStatusBody = z.object({
  status: z.enum(["draft", "sent", "paid", "overdue", "void", "partially_paid"]),
});

export const voidInvoiceBody = z
  .object({ reason: z.string().max(500).optional() })
  .optional();

// ── Bulk Operations ──────────────────────────────────────────────────────────

export const bulkInvoiceStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["draft", "sent", "paid", "overdue", "void", "partially_paid"]),
});
