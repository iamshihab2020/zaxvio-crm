import { z } from "zod";
import {
  idParam,
  paginationQuery,
  lineItemDescription,
  isoDate,
  boundedText,
} from "./common.js";
import { ITEM_TYPES } from "../line-items.js";

export { idParam };

export const quoteLineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const quoteStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

/**
 * Derived from `ITEM_TYPES`, not retyped — the same list already exists in
 * `lib/line-items.ts` and in the `item_type` pgEnum, and a fourth hand-written
 * copy is how they drift.
 *
 * `POST /line-items` guarded this through `isItemType` and 400'd; `PATCH` copied
 * whatever was in the body straight into the update, so `"banana"` reached the
 * enum as a 500 (QUO-19, verified).
 */
export const itemTypeSchema = z.enum(ITEM_TYPES);

/**
 * Money as a decimal string, bounded to what `numeric(10,2)` can hold.
 *
 * `quantity` and `unitPrice` were bare optional strings, so `1e15`, `-5` and
 * `abc` all passed validation and surfaced as a Postgres 500 rather than a 400
 * (QUO-18, verified). `numeric(10,2)` maxes out at 99,999,999.99.
 */
const decimalString = (opts: { min: number; max: number; label: string }) =>
  z
    .string()
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v.trim()), {
      message: `${opts.label} must be a number`,
    })
    .refine(
      (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= opts.min && n <= opts.max;
      },
      { message: `${opts.label} must be between ${opts.min} and ${opts.max}` },
    );

export const moneyString = decimalString({
  min: 0,
  max: 99_999_999.99,
  label: "Amount",
});

export const quantityString = decimalString({
  min: 0,
  max: 99_999_999.99,
  label: "Quantity",
});

/** Tax rate as a decimal fraction — 0.0825 is 8.25%. */
export const taxRateString = decimalString({
  min: 0,
  max: 1,
  label: "Tax rate",
});

export const quoteListQuery = paginationQuery.extend({
  status: quoteStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  sortBy: z
    .enum(["createdAt", "issuedDate", "expiryDate", "quoteNumber", "status", "totalAmount"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * `issuedDate` / `expiryDate` were `z.string().optional()`, so Postgres' date
 * parser saw them raw: `infinity`, `-infinity`, `today`, `epoch`, `now`,
 * `2026-02-30` and `2026-13-45` were all accepted on both verbs (QUO-17,
 * verified). An `infinity` expiry never lapses and renders as `Invalid Date`
 * everywhere. `isoDate` has carried the fix since BOOK-04; this file imported
 * three other primitives from the same module and not that one.
 */
/**
 * A line as supplied at creation time. Same rules as `addLineItemBody`, but
 * `unitPrice` and `itemType` are required — a line with neither is not a line,
 * and letting them through only to 400 inside the transaction would roll back
 * the whole quote.
 */
export const createLineItemBody = z.object({
  catalogItemId: z.string().uuid().optional(),
  itemType: itemTypeSchema,
  description: lineItemDescription,
  quantity: quantityString.optional(),
  unitPrice: moneyString,
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const createQuoteBody = z.object({
  customerId: z.string().uuid(),
  issuedDate: isoDate.optional(),
  expiryDate: isoDate.optional(),
  taxRate: taxRateString.optional(),
  discountAmount: moneyString.optional(),
  notes: boundedText(5000).optional(),
  equipmentId: z.string().uuid().optional(),
  /**
   * The create dialog collects line items before the quote exists. It used to
   * create the quote, then fire one `POST /line-items` per line from the
   * browser — N sequential server actions after the fact, with no transaction
   * and no error handling, so a failure part-way left a quote with some of its
   * lines and told the user nothing. Sending them here makes the whole thing
   * one atomic write.
   */
  lineItems: z.array(createLineItemBody).max(100).optional(),
});

export const updateQuoteBody = z.object({
  customerId: z.string().uuid().optional(),
  issuedDate: isoDate.optional(),
  expiryDate: isoDate.nullable().optional(),
  taxRate: taxRateString.optional(),
  discountAmount: moneyString.optional(),
  notes: boundedText(5000).nullable().optional(),
  equipmentId: z.string().uuid().nullable().optional(),
});

export const addLineItemBody = z.object({
  catalogItemId: z.string().uuid().optional(),
  itemType: itemTypeSchema.optional(),
  description: lineItemDescription,
  quantity: quantityString.optional(),
  unitPrice: moneyString.optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const updateLineItemBody = z.object({
  catalogItemId: z.string().uuid().nullable().optional(),
  itemType: itemTypeSchema.optional(),
  description: lineItemDescription,
  quantity: quantityString.optional(),
  unitPrice: moneyString.optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const convertBody = z.object({
  pipelineStageId: z.string().uuid().optional(),
  serviceType: z
    .enum(["installation", "repair", "maintenance", "inspection", "emergency", "consultation", "other"])
    .optional(),
});

export const activitiesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Bulk Operations ──────────────────────────────────────────────────────────

/**
 * `sent` is deliberately not accepted here. It is not a status change — it is
 * `POST /quotes/:id/send`, which mints the access token, renders the PDF and
 * emails the customer. Setting it directly produced a quote that `/send`,
 * `PATCH` and `DELETE` all then refused, because all three require `draft`
 * (QUO-01, verified). The transition table in `lib/quote-guards.ts` enforces the
 * rest.
 */
export const bulkQuoteStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["accepted", "declined", "expired"]),
});
