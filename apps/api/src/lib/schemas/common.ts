import { z } from "zod";

/**
 * `?flag=true` / `?flag=false` from a query string.
 *
 * NOT `z.coerce.boolean()` — that is `Boolean(value)`, and `Boolean("false")` is
 * `true`, so `?showArchived=false` returned *archived only*. Harmless while the
 * only caller omitted the param rather than sending `false`, but this schema is
 * shared by every list endpoint. (CUST-29)
 */
export const booleanFlag = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  showArchived: booleanFlag.default(false).optional(),
});

export const idParam = z.object({
  id: z.string().uuid(),
});

export const healthResponse = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
});

// ── Date / time primitives ───────────────────────────────────────────────────
//
// Every one of these guards a value that ends up interpolated into `${x}::date`
// or `${x}::time` in SQL. Postgres accepts far more than a calendar date there:
// `'infinity'`, `'today'`, `'epoch'` and `'now'` all parse, and the relative ones
// resolve in the *session* timezone (UTC on Neon), not the tenant's. A booking
// stored as `infinity` matches no date-range query, never appears on the
// calendar, and renders as `Invalid Date` in every formatter.
//
// The regex is what rejects the magic strings; the refine is what rejects
// `2026-02-30`, which the regex alone lets through and Postgres then 500s on.
// (BOOK-04 — the public booking schema had these; the authenticated ones did not.)

/** `YYYY-MM-DD`, and a date that actually exists on the calendar. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((val) => {
    // Round-tripping through UTC noon rejects 2026-02-30 / 2026-13-45, which
    // JS would otherwise silently roll forward into the next month.
    const d = new Date(`${val}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(val);
  }, "Not a real calendar date");

/** `HH:MM`, 00:00–23:59. */
export const isoTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Expected an HH:MM time")
  .refine((val) => {
    const [h, m] = val.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Not a real time of day");

/** `YYYY-MM`. */
export const isoMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected a YYYY-MM month")
  .refine((val) => {
    const month = Number(val.slice(5, 7));
    return month >= 1 && month <= 12;
  }, "Not a real calendar month");

/**
 * Free-text field with an explicit ceiling.
 *
 * Unbounded `z.string()` on a `text` column means a 100 KB address is a valid
 * request body. Every user-facing text field on a booking or calendar event
 * goes through here so the limit is visible at the schema, not implied by the UI.
 */
export function boundedText(max: number) {
  return z.string().max(max, `Too long (max ${max} characters)`);
}

/**
 * Line item description — optional on every verb, on jobs, invoices and quotes.
 *
 * A line item can be nothing but a price; when it is, the API names it after its
 * item type (see `lib/line-items.ts`), so nothing renders blank on a PDF. Lives
 * here because the three domains kept three different rules for one field:
 * jobs required 1-500 chars on update but not on add, invoices required 1-500 on
 * both, and quotes accepted an **unbounded** string — on the text that renders
 * into the public quote portal.
 */
export const lineItemDescription = boundedText(500).optional();
