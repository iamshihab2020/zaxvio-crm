import type {
  JobCostSummary,
  CostCoverage,
  RevenueBasis,
} from "@hvac-saas/types";
import type { DbClient } from "../analytics/types.js";
import type { JobCostRow } from "./schemas.js";
import { getJobCostInputs } from "./queries/job-costs.js";
import {
  toCents,
  fromCents,
  laborCents,
  marginPct,
} from "./money.js";

/**
 * Turn a job's raw cost inputs into a margin — and, just as importantly, into a
 * statement of how much of that margin is actually known.
 *
 * Nothing here is stored. The invoice money model established that a figure
 * derived from its inputs cannot drift from them, and margin has strictly more
 * inputs than invoice status does, so storing it would give it strictly more
 * ways to go stale.
 */

/**
 * The rule the whole feature rests on: **an unknown cost makes the total
 * incomplete, not lower.**
 *
 * A line item with no `unit_cost` contributes nothing to the sum, which is
 * arithmetically the same as contributing zero — and that is precisely the
 * danger. Zero cost reads as pure profit. So the sum is reported alongside a
 * count of what was skipped, and anything downstream that would present the
 * margin as fact must check `complete` first.
 */
function buildCoverage(row: JobCostRow, laborKnown: boolean): CostCoverage {
  const lineItems = row.line_item_count;
  const costed = row.costed_line_item_count;
  const gaps: string[] = [];

  const uncosted = lineItems - costed;
  if (uncosted > 0) {
    gaps.push(
      `${uncosted} of ${lineItems} line item${lineItems === 1 ? "" : "s"} ${
        uncosted === 1 ? "has" : "have"
      } no cost set`,
    );
  }
  if (!laborKnown) {
    gaps.push(
      row.actual_hours === null
        ? "No hours recorded for this job"
        : "No labour cost rate set",
    );
  }

  return {
    costedLineItems: costed,
    lineItems,
    laborCosted: laborKnown,
    complete: gaps.length === 0,
    gaps,
  };
}

/** Roll one row of cost inputs up into the summary the UI renders. */
export function summarise(row: JobCostRow): JobCostSummary {
  const lineItemCost = toCents(row.line_item_cost) ?? 0;
  const expenseCost = toCents(row.expense_cost) ?? 0;
  const labor = laborCents(row.actual_hours, row.labor_cost_rate);
  const laborKnown = labor !== null;
  const totalCost = lineItemCost + expenseCost + (labor ?? 0);

  // Invoiced revenue wins whenever an invoice exists, because the invoice is
  // the document the customer actually received; the job's own total is an
  // estimate that stops being maintained the moment the invoice is generated.
  // `null` here means no billed invoice — distinct from an invoice totalling 0.
  const invoiced = toCents(row.invoiced_total);
  const basis: RevenueBasis = invoiced === null ? "estimated" : "invoiced";
  const revenue = invoiced ?? toCents(row.job_total) ?? 0;

  const margin = revenue - totalCost;

  return {
    jobId: row.job_id,
    lineItemCost: fromCents(lineItemCost),
    expenseCost: fromCents(expenseCost),
    laborCost: fromCents(labor ?? 0),
    totalCost: fromCents(totalCost),
    actualHours: row.actual_hours,
    laborCostRate: row.labor_cost_rate,
    revenue: fromCents(revenue),
    revenueBasis: basis,
    margin: fromCents(margin),
    marginPct: marginPct(margin, revenue),
    coverage: buildCoverage(row, laborKnown),
  };
}

/** Cost summary for a single job, or null when the job is not this tenant's. */
export async function getJobCostSummary(
  db: DbClient,
  tenantId: string,
  jobId: string,
): Promise<JobCostSummary | null> {
  const [row] = await getJobCostInputs(db, tenantId, [jobId]);
  return row ? summarise(row) : null;
}

/**
 * Cost summaries for many jobs, keyed by id.
 *
 * One query for the whole set. The jobs list renders 20 rows and the report
 * groups hundreds; per-row fetching here is how a page ends up issuing 200
 * queries to draw one column.
 */
export async function getJobCostSummaries(
  db: DbClient,
  tenantId: string,
  jobIds: string[],
): Promise<Record<string, JobCostSummary>> {
  const rows = await getJobCostInputs(db, tenantId, jobIds);
  return Object.fromEntries(rows.map((r) => [r.job_id, summarise(r)]));
}
