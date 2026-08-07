import { z } from "zod";

/**
 * Zod schemas for the raw SQL the costing queries run (api-rules §4). These
 * catch schema drift at runtime — `numeric` arrives as a string, `count`
 * arrives as a string from `db.execute`, and both are cast explicitly in SQL so
 * the shape here is the shape Postgres actually returns.
 */

/** One job's cost inputs, aggregated from its line items and expenses. */
export const jobCostRow = z.object({
  job_id: z.string().uuid(),
  /** SUM(cost_total) over costed lines only. "0" when nothing is costed. */
  line_item_cost: z.string(),
  /** How many line items the job has, and how many carry a unit_cost. */
  line_item_count: z.coerce.number().int(),
  costed_line_item_count: z.coerce.number().int(),
  expense_cost: z.string(),
  actual_hours: z.string().nullable(),
  labor_cost_rate: z.string().nullable(),
  /** Job's own line-item total — the estimated-revenue fallback. */
  job_total: z.string(),
  /** SUM of billed invoices for this job. Null when it has none. */
  invoiced_total: z.string().nullable(),
});

export type JobCostRow = z.infer<typeof jobCostRow>;

/**
 * One completed job in the profitability window: the same cost inputs as
 * `jobCostRow`, plus the four dimensions the report groups by.
 *
 * Every label is nullable because every one of them can genuinely be absent — a
 * job need not have an assignee, and a customer row can be missing a surname.
 * The service supplies the fallback text; the schema does not invent one, so a
 * NULL that means "unassigned" can never be confused with a real name.
 */
export const jobProfitabilityRow = jobCostRow.extend({
  job_number: z.string(),
  title: z.string(),
  service_type: z.string(),
  customer_id: z.string().uuid().nullable(),
  customer_name: z.string().nullable(),
  assignee_id: z.string().nullable(),
  assignee_name: z.string().nullable(),
  completed_at: z.string(),
});

export type JobProfitabilityRow = z.infer<typeof jobProfitabilityRow>;

/**
 * How many cost inputs this tenant has configured at all — a count, not a
 * boolean. `z.coerce.boolean()` would be the natural thing to write and is a
 * trap: it is `Boolean(value)`, so the string `"false"` coerces to **true**.
 * That exact mistake made `?showArchived=false` return archived-only rows
 * (found in the architecture audit). Counts have no such edge.
 */
export const costingConfiguredRow = z.object({
  costed_items: z.coerce.number().int(),
  rates_set: z.coerce.number().int(),
});
