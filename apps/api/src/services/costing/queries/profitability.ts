import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient } from "../../analytics/types.js";
import { jobProfitabilityRow } from "../schemas.js";
import { COST_INPUT_COLUMNS, COST_INPUT_LATERALS } from "./job-costs.js";

/**
 * Hard ceiling on how many jobs one report window will roll up.
 *
 * The rollup happens in TypeScript rather than SQL (see
 * `profitability.service.ts` for why), so the row set has to be bounded. 2,000
 * completed jobs is far beyond what the target user books in a reporting
 * window, and the caller is *told* when it bites — a silently truncated total
 * reads as a real one.
 */
export const PROFITABILITY_ROW_LIMIT = 2000;

/**
 * Every completed job in the window with its cost inputs and its four grouping
 * dimensions, one row per job.
 *
 * "In the window" is `completed_at`, not `scheduled_date`: profitability is a
 * question about work that finished and got billed, and a job scheduled in
 * March that finished in May earned its money in May. The date is resolved in
 * the tenant's timezone, matching every other boundary in analytics — a job
 * completed at 8pm Central on the last day of the month belongs to that month,
 * not to the next one that UTC would file it under.
 *
 * The customer join carries the tenant predicate on the JOIN itself. Three
 * domains have shipped the bug where it was left off and a shared id attached
 * another tenant's row.
 */
export async function getProfitabilityInputs(
  db: DbClient,
  tenantId: string,
  timezone: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      ${COST_INPUT_COLUMNS},
      j.job_number                                  AS job_number,
      j.title                                       AS title,
      j.service_type::text                          AS service_type,
      j.customer_id::text                           AS customer_id,
      NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') AS customer_name,
      j.assignee_id                                 AS assignee_id,
      u.name                                        AS assignee_name,
      (j.completed_at AT TIME ZONE ${timezone})::text AS completed_at
    FROM jobs j
    ${COST_INPUT_LATERALS}
    LEFT JOIN customers c
      ON c.id = j.customer_id AND c.tenant_id = j.tenant_id
    LEFT JOIN "user" u ON u.id = j.assignee_id
    WHERE j.tenant_id = ${tenantId}
      AND j.archived_at IS NULL
      AND j.completed_at IS NOT NULL
      AND (j.completed_at AT TIME ZONE ${timezone})::date >= ${from}::date
      AND (j.completed_at AT TIME ZONE ${timezone})::date <= ${to}::date
    ORDER BY j.completed_at DESC
    LIMIT ${PROFITABILITY_ROW_LIMIT + 1}
  `);

  return z.array(jobProfitabilityRow).parse(rows);
}
