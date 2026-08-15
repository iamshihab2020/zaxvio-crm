import { z } from "zod";
import { idParam, isoDate, boundedText } from "./common.js";

export { idParam };

/**
 * Expense categories. Mirrors `expenseCategoryEnum` in the Drizzle schema as a
 * Zod enum rather than importing the pgEnum (api-rules §4).
 */
export const expenseCategorySchema = z.enum([
  "material",
  "subcontractor",
  "permit",
  "fuel",
  "equipment_rental",
  "other",
]);

/**
 * A money amount as a string, because the columns are `numeric`.
 *
 * Same shape as `moneyString` in `schemas/invoices.ts`: an 8-digit ceiling and
 * at most two decimals. Sending a float would round-trip through IEEE 754 on
 * the way to a `numeric(10,2)` column.
 */
const moneyString = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Must be a valid amount");

// ── Params ────────────────────────────────────────────────────────────────────

export const expenseParams = z.object({
  id: z.string().uuid(),
  expenseId: z.string().uuid(),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createJobExpenseBody = z.object({
  category: expenseCategorySchema.default("material"),
  description: boundedText(500).min(1, "Description is required"),
  amount: moneyString,
  // `isoDate`, never a bare `z.string()`: this value reaches `${x}::date` in
  // the report's window filter, where Postgres would happily accept 'infinity'
  // and produce an expense that matches no date range ever queried (BOOK-04).
  incurredOn: isoDate,
  vendor: boundedText(200).optional(),
});

export const updateJobExpenseBody = z.object({
  category: expenseCategorySchema.optional(),
  description: boundedText(500).min(1).optional(),
  amount: moneyString.optional(),
  incurredOn: isoDate.optional(),
  // Nullable so the vendor can be cleared, not just changed.
  vendor: boundedText(200).nullable().optional(),
});

/*
 * `updateJobLaborBody` is gone with the endpoint it validated. Labour is no
 * longer a pair of fields on the job — see `schemas/job-time.ts`.
 */

/** Per-member hourly cost override. */
export const setMemberRateBody = z.object({
  userId: z.string().min(1),
  hourlyCostRate: moneyString,
});

export const memberRateParams = z.object({
  userId: z.string().min(1),
});
