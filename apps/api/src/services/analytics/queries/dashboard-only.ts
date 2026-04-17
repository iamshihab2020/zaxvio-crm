import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient } from "../types.js";
import {
  activityRow,
  todayJobRow,
  sparklineCountRow,
  sparklineAmountRow,
  dashboardPipelineRow,
} from "../schemas.js";

/** Recent activity (UNION of job_activities + quote_activities). */
export async function getRecentActivity(db: DbClient, tenantId: string, limit = 10) {
  const rows = await db.execute(sql`
    (
      SELECT
        ja.id,
        'job' AS type,
        ja.type AS action,
        ja.description,
        ja.job_id AS entity_id,
        COALESCE(j.job_number, 'JOB') AS entity_label,
        ja.created_at::text AS created_at
      FROM job_activities ja
      LEFT JOIN jobs j ON j.id = ja.job_id
      WHERE ja.tenant_id = ${tenantId}
      ORDER BY ja.created_at DESC
      LIMIT ${limit}
    )
    UNION ALL
    (
      SELECT
        qa.id,
        'quote' AS type,
        qa.type AS action,
        qa.description,
        qa.quote_id AS entity_id,
        COALESCE(q.quote_number, 'QT') AS entity_label,
        qa.created_at::text AS created_at
      FROM quote_activities qa
      LEFT JOIN quotes q ON q.id = qa.quote_id
      WHERE qa.tenant_id = ${tenantId}
      ORDER BY qa.created_at DESC
      LIMIT ${limit}
    )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return z.array(activityRow).parse(rows);
}

/** Today's scheduled jobs with customer info. */
export async function getTodaySchedule(db: DbClient, tenantId: string, limit = 20) {
  const rows = await db.execute(sql`
    SELECT
      j.id,
      j.job_number,
      c.first_name || ' ' || c.last_name AS customer_name,
      j.scheduled_start::text,
      j.scheduled_end::text,
      j.status,
      j.priority,
      j.service_type
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    WHERE j.tenant_id = ${tenantId}
      AND j.scheduled_date = CURRENT_DATE
    ORDER BY j.scheduled_start ASC NULLS LAST
    LIMIT ${limit}
  `);
  return z.array(todayJobRow).parse(rows);
}

/** Weekly job volume sparkline (last 7 days). */
export async function getWeeklyJobVolume(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      d.day::date::text AS day,
      COUNT(j.id)::text AS count
    FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
    LEFT JOIN jobs j ON j.tenant_id = ${tenantId} AND j.scheduled_date = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);
  return z.array(sparklineCountRow).parse(rows);
}

/** Weekly revenue sparkline (last 7 days). */
export async function getWeeklyRevenue(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      d.day::date::text AS day,
      COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
    FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
    LEFT JOIN invoice_payments ip ON ip.tenant_id = ${tenantId} AND ip.payment_date::date = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);
  return z.array(sparklineAmountRow).parse(rows);
}

/**
 * Job pipeline stage distribution for the dashboard.
 * If `pipelineId` is provided, scopes to that pipeline; otherwise falls back to the tenant's default pipeline.
 */
export async function getDashboardPipeline(
  db: DbClient,
  tenantId: string,
  pipelineId?: string | null,
) {
  const pipelineJoin = pipelineId
    ? sql`INNER JOIN pipelines p ON p.id = jps.pipeline_id AND p.id = ${pipelineId}`
    : sql`INNER JOIN pipelines p ON p.id = jps.pipeline_id AND p.is_default = true`;

  const rows = await db.execute(sql`
    SELECT
      jps.name AS stage_name,
      jps.label AS stage_label,
      jps.color AS stage_color,
      COUNT(j.id)::text AS job_count
    FROM job_pipeline_stages jps
    ${pipelineJoin}
    LEFT JOIN jobs j
      ON j.status = jps.name AND j.pipeline_id = jps.pipeline_id
    WHERE jps.tenant_id = ${tenantId}
    GROUP BY jps.name, jps.label, jps.color, jps.sort_order
    ORDER BY jps.sort_order
  `);
  return z.array(dashboardPipelineRow).parse(rows);
}
