/**
 * Primitives every event payload is built from.
 *
 * ## The one rule that shapes this whole file
 *
 * **A payload is JSON, not JavaScript.** It is written to a `jsonb` column and
 * read back by a different process, so whatever survives that round trip is the
 * only thing the schema may describe. A `Date` does not survive it — it is
 * written as an ISO string and comes back a string — so `z.date()` would pass on
 * the producer side and fail on the consumer side, which is exactly the
 * write/read drift the double-parse exists to catch.
 *
 * So: timestamps are ISO strings, money is a decimal string (Drizzle returns
 * `numeric` as a string, and rounding it into a float is how a total stops
 * matching its own line items), and there is no `z.date()`, no `z.bigint()` and
 * no `z.map()` anywhere below.
 */

import { z } from "zod";

// ── Identifiers ──────────────────────────────────────────────────────────────

export const uuidField = z
  .string()
  .uuid()
  .meta({ example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });

/**
 * Better Auth owns `user.id` and types it `text`, not `uuid` — every FK to a
 * user in this schema is `text("assignee_id")` / `text("actor_user_id")` for
 * that reason. A `z.string().uuid()` here would reject real ids.
 */
export const userIdField = z.string().min(1).meta({ example: "user_2abcDEF" });

// ── Time ─────────────────────────────────────────────────────────────────────

/**
 * `2026-08-07T13:00:00.000Z` — what `Date.prototype.toISOString()` produces and
 * what `jsonb` gives back.
 */
export const isoDateTimeField = z
  .string()
  .datetime()
  .meta({ example: "2026-08-07T13:00:00.000Z" });

/**
 * `YYYY-MM-DD`, and a date that exists on the calendar.
 *
 * Same guard as `lib/schemas/common.ts` `isoDate`, for the same reason: these
 * values come off `date` columns and end up interpolated into trigger filters
 * and `{{job.scheduledDate}}`. Postgres accepts `'infinity'` and `'today'` in a
 * `::date` cast; a booking stored as `infinity` matches no range query and
 * renders as `Invalid Date` everywhere. (BOOK-04)
 */
export const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((val) => {
    const d = new Date(`${val}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(val);
  }, "Not a real calendar date")
  .meta({ example: "2026-08-07" });

/** `HH:MM` or `HH:MM:SS` — Postgres `time` columns come back with seconds. */
export const isoTimeField = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected an HH:MM time")
  .meta({ example: "09:30:00" });

// ── Money ────────────────────────────────────────────────────────────────────

/**
 * A `numeric` column as Drizzle hands it over: a decimal **string**.
 *
 * Kept as a string on purpose. `services/costing/money.ts` exists because a
 * margin is a difference of two sums, so float error is doubled; the same
 * applies the moment a filter compares `{{invoice.totalAmount}}` to a threshold.
 * The comparison operators coerce at the point of comparison, once, rather than
 * every payload paying for it.
 */
export const moneyField = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Expected a decimal amount as a string")
  .meta({ example: "1250.00" });

// ── Domain enums ─────────────────────────────────────────────────────────────
//
// Mirrored from `packages/database/src/schema/enums.ts` rather than imported —
// api-rules §4, and this package must stay importable by the browser bundle,
// which cannot load Drizzle.

export const jobLifecycleSchema = z.enum([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const jobPrioritySchema = z.enum(["standard", "urgent", "emergency"]);

export const serviceTypeSchema = z.enum([
  "installation",
  "repair",
  "maintenance",
  "inspection",
  "emergency",
  "consultation",
  "other",
]);

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "void",
]);

export const quoteStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

export const bookingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

export const paymentMethodSchema = z.enum([
  "cash",
  "check",
  "credit_card",
  "bank_transfer",
  "other",
]);

export const serviceFrequencySchema = z.enum([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

export const conversationChannelSchema = z.enum(["email", "sms"]);

// ── Shared fragments ─────────────────────────────────────────────────────────

/**
 * Every event about a customer-owned record carries the customer's identity, so
 * `{{customer.firstName}}` resolves in the *first* node without a query, and so
 * a filter on "which customer" needs no loader.
 *
 * `email` is nullable because `customers.email` is — a phone-only customer is
 * normal in this business, and an email node has to be able to say "no address"
 * rather than fail.
 */
export const customerRef = {
  customerId: uuidField,
  customerFirstName: z.string(),
  customerLastName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
};

/**
 * Which fields a PATCH actually changed.
 *
 * The value is the *field name*, never the value itself. Old and new values in
 * an event payload would put customer notes and addresses into a queue table
 * with 7-day retention and into every trigger evaluation record, for a filter
 * nobody asked for. "Was `assigneeId` among the changes" answers the real
 * question — "notify me when a job gets reassigned" — at a fraction of the
 * exposure.
 */
export const changedFieldsField = z.array(z.string()).max(64);
