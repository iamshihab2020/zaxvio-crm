import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient } from "../../analytics/types.js";
import { jobCostRow, costingConfiguredRow } from "../schemas.js";

/**
 * "Billed" has exactly one definition in this codebase, and this is a second
 * place that needs it: a draft invoice was never sent and a void one was
 * withdrawn, so neither is revenue attributable to a job.
 *
 * It is duplicated here rather than imported from
 * `analytics/queries/revenue.ts` for one reason — that copy is a module-private
 * `const` and exporting it would make an analytics-internal fragment part of
 * that module's public surface. If a third consumer appears, lift it into a
 * shared `lib/invoice-filters.ts` instead of growing a third copy. Both copies
 * alias the table `i`, so the fragment always qualifies its columns.
 *
 * The dashboard work already proved what happens without it: a single $12,669
 * draft overstated what had been billed by 66%.
 */
const BILLED_FILTER = sql`i.archived_at IS NULL AND i.status NOT IN ('draft', 'void')`;

/**
 * The columns that make up `jobCostRow`, and the joins that produce them.
 *
 * Exported as fragments so the profitability report can select the *same*
 * inputs over a different WHERE clause. Two consumers, one definition: if the
 * report computed its cost side independently it would eventually disagree with
 * the number on the job's own Costs tab, and the user would have no way to tell
 * which of the two was lying.
 *
 * Both fragments assume the driving table is aliased `j`.
 */
export const COST_INPUT_COLUMNS = sql`
  j.id::text AS job_id,
  COALESCE(li.cost, 0)::text        AS line_item_cost,
  COALESCE(li.total_count, 0)       AS line_item_count,
  COALESCE(li.costed_count, 0)      AS costed_line_item_count,
  COALESCE(ex.cost, 0)::text        AS expense_cost,
  tm.hours::text                    AS actual_hours,
  COALESCE(tm.cost, 0)::text        AS labor_cost,
  COALESCE(tm.total_count, 0)       AS time_entry_count,
  COALESCE(tm.costed_count, 0)      AS costed_time_entry_count,
  COALESCE(tm.auto_stopped_count, 0) AS auto_stopped_time_entry_count,
  COALESCE(j.total_amount, 0)::text AS job_total,
  inv.total::text                   AS invoiced_total
`;

/**
 * The four sub-selects are correlated laterals rather than plain joins because
 * joining line items *and* expenses to jobs in one query multiplies the two sets
 * together — a job with 4 line items and 3 expenses would count each line item 3
 * times and each expense 4 times. That fan-out is the classic way a costing
 * number comes out plausible and wrong, and it is silent: nothing about $2,400
 * looks like $800 counted three times. Time entries are a fourth set on the same
 * job, so adding them as a plain join would have multiplied all three.
 *
 * `costed_count` is what makes the coverage rule enforceable: it lets the caller
 * distinguish "this job cost $0" from "nobody has costed this job". Time entries
 * carry the same pair of counts for the same reason — an entry logged by someone
 * with no rate set understates labour exactly as an uncosted line item
 * understates materials.
 */
export const COST_INPUT_LATERALS = sql`
  LEFT JOIN LATERAL (
    SELECT
      SUM(li.cost_total)                              AS cost,
      COUNT(*)                                        AS total_count,
      COUNT(*) FILTER (WHERE li.unit_cost IS NOT NULL) AS costed_count
    FROM job_line_items li
    WHERE li.tenant_id = j.tenant_id AND li.job_id = j.id
  ) li ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(e.amount) AS cost
    FROM job_expenses e
    WHERE e.tenant_id = j.tenant_id AND e.job_id = j.id
  ) ex ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(i.total_amount) AS total
    FROM invoices i
    WHERE i.tenant_id = j.tenant_id
      AND i.job_id = j.id
      AND ${BILLED_FILTER}
  ) inv ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      ROUND(SUM(EXTRACT(EPOCH FROM (t.ended_at - t.started_at))) / 3600, 2) AS hours,
      -- Each entry at its OWN snapshotted rate, summed. This is what makes a
      -- job worked by two people cost what it actually cost; the column it
      -- replaces was one number times one rate resolved from the assignee.
      --
      -- An entry with a NULL rate contributes NULL, which SUM skips -- so
      -- unknown labour is omitted rather than counted as free, and costed_count
      -- below is what tells the caller it happened.
      ROUND(SUM(
        EXTRACT(EPOCH FROM (t.ended_at - t.started_at)) / 3600 * t.hourly_cost_rate
      ), 2) AS cost,
      COUNT(*)                                                    AS total_count,
      COUNT(*) FILTER (WHERE t.hourly_cost_rate IS NOT NULL)      AS costed_count,
      COUNT(*) FILTER (WHERE t.auto_stopped)                      AS auto_stopped_count
    FROM job_time_entries t
    WHERE t.tenant_id = j.tenant_id
      AND t.job_id = j.id
      -- A running timer contributes nothing until it stops. Without this a
      -- job's margin would move every time the page refreshed.
      AND t.ended_at IS NOT NULL
  ) tm ON TRUE
`;

/**
 * Every cost input for a set of jobs, in one round trip.
 *
 * `ANY(ARRAY[$1, $2, …]::uuid[])`, built server-side. Interpolating the array
 * itself — `ANY(${jobIds}::uuid[])` — binds it as ONE scalar parameter, so
 * Postgres tried to read a single uuid as an array literal and raised `22P02`.
 * The Costs tab rendered "Couldn't load costs" for every job.
 *
 * The cast does not save it: the parameter's *value* is already malformed by
 * the time `::uuid[]` applies. This is the second site of that defect today —
 * the trigger matcher had it with `&&` — which is why the scan now looks for
 * any JS array reaching a `sql` template rather than for one operator.
 */
export async function getJobCostInputs(
  db: DbClient,
  tenantId: string,
  jobIds: string[],
) {
  if (jobIds.length === 0) return [];

  const rows = await db.execute(sql`
    SELECT ${COST_INPUT_COLUMNS}
    FROM jobs j
    ${COST_INPUT_LATERALS}
    WHERE j.tenant_id = ${tenantId}
      AND j.id = ANY(ARRAY[${sql.join(
        jobIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[])
  `);

  return z.array(jobCostRow).parse(rows);
}

/**
 * Has this tenant set up costing at all?
 *
 * Without this the report cannot tell "you have no margin" from "you have not
 * entered any costs", and it would show a confident 100%-margin headline to
 * somebody who has simply never opened the settings page. Two counts, so the
 * empty state can say which half is missing.
 */
export async function getCostingConfiguration(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM catalog_items
        WHERE tenant_id = ${tenantId} AND unit_cost IS NOT NULL) AS costed_items,
      (SELECT COUNT(*) FROM tenant_member_rates
        WHERE tenant_id = ${tenantId})
      + (SELECT COUNT(*) FROM tenants
        WHERE id = ${tenantId} AND default_labor_cost_rate IS NOT NULL) AS rates_set
  `);
  return z.array(costingConfiguredRow).parse(rows)[0];
}
