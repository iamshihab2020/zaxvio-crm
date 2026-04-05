import { z } from "zod";
import { idParam, paginationQuery } from "./common.js";

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
  status: z
    .enum(["draft", "sent", "paid", "overdue", "void", "partially_paid"])
    .optional(),
  customerId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createInvoiceBody = z.object({
  customerId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  issuedDate: z.string().optional(),
  dueDate: z.string().optional(),
  taxRate: z.string().optional(),
  discountAmount: z.string().optional(),
  notes: z.string().optional(),
});

export const updateInvoiceBody = z.object({
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  taxRate: z.string().optional(),
  discountAmount: z.string().optional(),
  customerId: z.string().uuid().optional(),
  issuedDate: z.string().optional(),
});

export const addLineItemBody = z.object({
  description: z.string().optional(),
  unitPrice: z.string().optional(),
  itemType: z.enum(["labor", "material", "other"]).optional(),
  quantity: z.string().optional(),
  catalogItemId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateLineItemBody = z.object({
  description: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  itemType: z.enum(["labor", "material", "other"]).optional(),
});

export const recordPaymentBody = z.object({
  amount: z.string().min(1),
  paymentMethod: z.string().optional(),
  paymentDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const updateInvoiceStatusBody = z.object({
  status: z.string().min(1),
});
