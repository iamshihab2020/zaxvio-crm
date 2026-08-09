import type { ProfitabilityRow, ProfitabilitySection } from "@hvac-saas/types";
import type { DbClient } from "../analytics/types.js";
import { titleCase } from "../analytics/types.js";
import type { JobProfitabilityRow } from "./schemas.js";
import {
  getProfitabilityInputs,
  PROFITABILITY_ROW_LIMIT,
} from "./queries/profitability.js";
import { getCostingConfiguration } from "./queries/job-costs.js";
import { summarise } from "./costing.service.js";
import { toCents, fromCents, marginPct } from "./money.js";

/**
 * How many rows each grouping returns. These are contract, not truncation: the
 * report says "the 100 thinnest-margin jobs", which is the list a contractor
 * acts on. Sending 2,000 rows to draw a table nobody scrolls to the bottom of
 * is the alternative.
 *
 * Service type is bounded by an enum and assignee by team size, so neither is
 * capped.
 */
const MAX_JOB_ROWS = 100;
const MAX_CUSTOMER_ROWS = 25;

/** Accumulator for one group while rows are being folded into it. */
interface Bucket {
  key: string;
  label: string;
  jobCount: number;
  revenueCents: number;
  costCents: number;
  excludedJobCount: number;
}

function bucketOf(
  groups: Map<string, Bucket>,
  key: string,
  label: string,
): Bucket {
  let b = groups.get(key);
  if (!b) {
    b = {
      key,
      label,
      jobCount: 0,
      revenueCents: 0,
      costCents: 0,
      excludedJobCount: 0,
    };
    groups.set(key, b);
  }
  return b;
}

function finalise(b: Bucket): ProfitabilityRow {
  const margin = b.revenueCents - b.costCents;
  return {
    key: b.key,
    label: b.label,
    jobCount: b.jobCount,
    revenue: fromCents(b.revenueCents),
    cost: fromCents(b.costCents),
    margin: fromCents(margin),
    marginPct: marginPct(margin, b.revenueCents),
    excludedJobCount: b.excludedJobCount,
  };
}

/** Thinnest margin first — a report you act on leads with the problem. */
function byThinnestMargin(a: ProfitabilityRow, b: ProfitabilityRow): number {
  const am = a.marginPct;
  const bm = b.marginPct;
  // Rows with no measurable percentage (zero revenue) sort last: they are not
  // "the worst margin", they are a different question.
  if (am === null && bm === null) return 0;
  if (am === null) return 1;
  if (bm === null) return -1;
  return am - bm;
}

/**
 * The profitability section of `/reports`.
 *
 * The rollup runs in TypeScript over per-job rows rather than as a SQL
 * `GROUP BY`, deliberately. `summarise()` is the single definition of what a
 * job's margin *is* — which cost inputs count, which revenue basis wins, and
 * critically when the figure is too incomplete to state. Re-expressing all of
 * that in SQL would give the report a second, silently diverging opinion, and
 * the user would have no way to tell which of the two numbers was wrong. The
 * row set is bounded instead.
 *
 * The exclusion rule follows from the same place: a job whose costs are only
 * half entered is left out of the money entirely rather than summed with the
 * missing half read as zero. Counting it would pull every group's margin toward
 * 100% and make an unprofitable segment look healthy — the precise failure mode
 * that makes a costing tool worse than no costing tool.
 */
export async function getProfitabilityReport(
  db: DbClient,
  tenantId: string,
  timezone: string,
  from: string,
  to: string,
): Promise<ProfitabilitySection> {
  const [rows, config] = await Promise.all([
    getProfitabilityInputs(db, tenantId, timezone, from, to),
    getCostingConfiguration(db, tenantId),
  ]);

  const truncated = rows.length > PROFITABILITY_ROW_LIMIT;
  const jobs: JobProfitabilityRow[] = truncated
    ? rows.slice(0, PROFITABILITY_ROW_LIMIT)
    : rows;

  const byJobRows: ProfitabilityRow[] = [];
  const byServiceType = new Map<string, Bucket>();
  const byCustomer = new Map<string, Bucket>();
  const byAssignee = new Map<string, Bucket>();

  let totalRevenue = 0;
  let totalCost = 0;
  let totalJobs = 0;
  let totalExcluded = 0;

  for (const row of jobs) {
    const summary = summarise(row);
    const complete = summary.coverage.complete;
    const revenue = complete ? (toCents(summary.revenue) ?? 0) : 0;
    const cost = complete ? (toCents(summary.totalCost) ?? 0) : 0;

    if (complete) {
      totalJobs += 1;
      totalRevenue += revenue;
      totalCost += cost;
      byJobRows.push({
        key: row.job_id,
        label: `${row.job_number} · ${row.title}`,
        jobCount: 1,
        revenue: summary.revenue,
        cost: summary.totalCost,
        margin: summary.margin,
        marginPct: summary.marginPct,
        excludedJobCount: 0,
      });
    } else {
      totalExcluded += 1;
    }

    const targets: Bucket[] = [
      bucketOf(
        byServiceType,
        row.service_type,
        titleCase(row.service_type),
      ),
      bucketOf(
        byCustomer,
        row.customer_id ?? "unknown",
        row.customer_name ?? "Unknown customer",
      ),
      // A job with no assignee is a real and common state, and it groups: "who
      // is this work costing us under" has an answer even when nobody is named.
      bucketOf(
        byAssignee,
        row.assignee_id ?? "unassigned",
        row.assignee_name ?? "Unassigned",
      ),
    ];

    for (const bucket of targets) {
      if (complete) {
        bucket.jobCount += 1;
        bucket.revenueCents += revenue;
        bucket.costCents += cost;
      } else {
        bucket.excludedJobCount += 1;
      }
    }
  }

  const totalMargin = totalRevenue - totalCost;

  const groupRows = (groups: Map<string, Bucket>, limit?: number) => {
    const out = [...groups.values()].map(finalise);
    // Highest revenue first for the "where does the money come from" groupings;
    // the thin-margin ordering only makes sense for individual jobs, where the
    // row is a thing you can go and fix.
    out.sort((a, b) => Number(b.revenue) - Number(a.revenue));
    return limit === undefined ? out : out.slice(0, limit);
  };

  byJobRows.sort(byThinnestMargin);

  return {
    totals: {
      jobCount: totalJobs,
      revenue: fromCents(totalRevenue),
      cost: fromCents(totalCost),
      margin: fromCents(totalMargin),
      marginPct: marginPct(totalMargin, totalRevenue),
      excludedJobCount: totalExcluded,
      costingConfigured: config.costed_items > 0 || config.rates_set > 0,
      truncated,
    },
    byJob: byJobRows.slice(0, MAX_JOB_ROWS),
    byServiceType: groupRows(byServiceType),
    byCustomer: groupRows(byCustomer, MAX_CUSTOMER_ROWS),
    byAssignee: groupRows(byAssignee),
  };
}
