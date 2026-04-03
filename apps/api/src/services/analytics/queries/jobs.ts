import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import {
  monthlyCountRow,
  statusCountRow,
  priorityCountRow,
  serviceTypeCountRow,
  avgDaysRow,
  pipelineRow,
  jobKpisRow,
  totalCountRow,
  jobsTodayRow,
} from "../schemas.js";

/** Job volume by month with generate_series zero-fill. */
export async function getJobVolumeTrend(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      to_char(m.month, 'Mon YYYY') AS month_label,
      COUNT(j.id)::text AS count
    FROM generate_series(
      date_trunc('month', ${rangeFrom}::date),
      date_trunc('month', ${rangeTo}::date),
      INTERVAL '1 month'
    ) AS m(month)
    LEFT JOIN jobs j
      ON j.tenant_id = ${tenantId}
      AND j.scheduled_date >= m.month
      AND j.scheduled_date < m.month + INTERVAL '1 month'
    GROUP BY m.month
    ORDER BY m.month
  `);
  return z.array(monthlyCountRow).parse(rows);
}

/** Jobs grouped by status in date range. */
export async function getJobsByStatus(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT status, COUNT(*)::text AS count
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date >= ${rangeFrom}::date
      AND scheduled_date <= ${rangeTo}::date
    GROUP BY status
    ORDER BY COUNT(*) DESC
  `);
  return z.array(statusCountRow).parse(rows);
}

/** Jobs grouped by priority in date range. */
export async function getJobsByPriority(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT priority, COUNT(*)::text AS count
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date >= ${rangeFrom}::date
      AND scheduled_date <= ${rangeTo}::date
    GROUP BY priority
    ORDER BY COUNT(*) DESC
  `);
  return z.array(priorityCountRow).parse(rows);
}

/** Jobs grouped by service type in date range. */
export async function getJobsByServiceType(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT service_type, COUNT(*)::text AS count
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date >= ${rangeFrom}::date
      AND scheduled_date <= ${rangeTo}::date
    GROUP BY service_type
    ORDER BY COUNT(*) DESC
  `);
  return z.array(serviceTypeCountRow).parse(rows);
}

/** Average completion time in days for completed jobs. */
export async function getAvgCompletionDays(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (completed_at - scheduled_date::timestamp)) / 86400),
      0
    )::text AS avg_days
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND completed_at IS NOT NULL
      AND scheduled_date >= ${rangeFrom}::date
      AND scheduled_date <= ${rangeTo}::date
  `);
  return z.array(avgDaysRow).parse(rows);
}

/** Pipeline stage distribution for default pipeline. Shared with dashboard. */
export async function getJobPipelineDistribution(
  db: DbClient,
  tenantId: string,
  rangeFrom?: string,
  rangeTo?: string,
) {
  const dateFilter = rangeFrom && rangeTo
    ? sql`AND j.scheduled_date >= ${rangeFrom}::date AND j.scheduled_date <= ${rangeTo}::date`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      jps.label AS stage_label,
      jps.color AS stage_color,
      COUNT(j.id)::text AS count
    FROM job_pipeline_stages jps
    INNER JOIN pipelines p ON p.id = jps.pipeline_id AND p.is_default = true
    LEFT JOIN jobs j
      ON j.status = jps.name AND j.pipeline_id = jps.pipeline_id
      AND j.tenant_id = ${tenantId}
      ${dateFilter}
    WHERE jps.tenant_id = ${tenantId}
    GROUP BY jps.label, jps.color, jps.sort_order
    ORDER BY jps.sort_order
  `);
  return z.array(pipelineRow).parse(rows);
}

/** Job KPIs (total, completed, cancelled) for date range. */
export async function getJobKpis(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date >= ${rangeFrom}::date
      AND scheduled_date <= ${rangeTo}::date
  `);
  return z.array(jobKpisRow).parse(rows);
}

/** Simple job count for a date range. Shared with dashboard. */
export async function getJobCount(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date >= ${from}::date
      AND scheduled_date <= ${to}::date
  `);
  return z.array(totalCountRow).parse(rows);
}

/** Jobs today with emergency count. Dashboard-specific. */
export async function getJobsToday(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE priority = 'emergency')::text AS emergency
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date = CURRENT_DATE
  `);
  return z.array(jobsTodayRow).parse(rows);
}
