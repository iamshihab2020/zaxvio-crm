import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient } from "../types.js";
import {
  activityRow,
  dashboardPipelineRow,
  upcomingEventRow,
  upcomingJobRow,
  upcomingBookingRow,
} from "../schemas.js";

/**
 * "Today" in the tenant's timezone, as a SQL `date`.
 *
 * Postgres `CURRENT_DATE` uses the session timezone, which is UTC on Neon — a US
 * Central tenant would see the dashboard roll over at 6-7 PM local.
 */
function tenantToday(timezone: string) {
  return sql`(now() AT TIME ZONE ${timezone})::date`;
}

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
      LEFT JOIN jobs j ON j.id = ja.job_id AND j.tenant_id = ${tenantId}
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
      LEFT JOIN quotes q ON q.id = qa.quote_id AND q.tenant_id = ${tenantId}
      WHERE qa.tenant_id = ${tenantId}
      ORDER BY qa.created_at DESC
      LIMIT ${limit}
    )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return z.array(activityRow).parse(rows);
}

/* `getWeeklyJobVolume` and `getWeeklyRevenue` lived here, feeding the sparkline
   on the "Jobs Today" KPI pill. That sparkline was removed when the three pills
   were made a consistent set, but both queries stayed in the dashboard fan-out —
   two round trips per load, parsed, mapped onto the response and read by nobody.
   The forward-looking Week Ahead widget covers the same question better, from
   the agenda payload the dashboard already fetches. */

/** Calendar events in a forward window (dashboard agenda). */
export async function getUpcomingEvents(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      id::text,
      title,
      description,
      event_date::text,
      start_time::text,
      end_time::text,
      contact_name,
      address,
      color
    FROM calendar_events
    WHERE tenant_id = ${tenantId}
      AND event_date >= ${from}::date
      AND event_date <= ${to}::date
    ORDER BY event_date ASC, start_time ASC NULLS LAST
    LIMIT 100
  `);
  return z.array(upcomingEventRow).parse(rows);
}

/** Scheduled jobs in a forward window (dashboard agenda). */
export async function getUpcomingJobs(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      j.id::text,
      j.job_number,
      j.title,
      (c.first_name || ' ' || c.last_name) AS customer_name,
      j.address,
      j.service_type::text,
      j.priority::text,
      j.scheduled_date::text,
      j.scheduled_start::text,
      j.scheduled_end::text
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id AND c.tenant_id = ${tenantId}
    WHERE j.tenant_id = ${tenantId}
      AND j.archived_at IS NULL
      AND j.status <> 'cancelled'
      AND j.scheduled_date >= ${from}::date
      AND j.scheduled_date <= ${to}::date
    ORDER BY j.scheduled_date ASC, j.scheduled_start ASC NULLS LAST
    LIMIT 50
  `);
  return z.array(upcomingJobRow).parse(rows);
}

/** Bookings in a forward window (dashboard agenda). */
export async function getUpcomingBookings(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      id::text,
      customer_name,
      service_type::text,
      booking_date::text,
      preferred_time::text,
      address,
      description
    FROM bookings
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND status <> 'cancelled'
      AND booking_date >= ${from}::date
      AND booking_date <= ${to}::date
    ORDER BY booking_date ASC, preferred_time ASC NULLS LAST
    LIMIT 50
  `);
  return z.array(upcomingBookingRow).parse(rows);
}

/**
 * Job pipeline stage distribution for the dashboard.
 * If `pipelineId` is provided, scopes to that pipeline; otherwise falls back to the
 * tenant's default pipeline.
 */
export async function getDashboardPipeline(
  db: DbClient,
  tenantId: string,
  pipelineId?: string | null,
) {
  const pipelineJoin = pipelineId
    ? sql`INNER JOIN pipelines p
            ON p.id = jps.pipeline_id
           AND p.id = ${pipelineId}
           AND p.tenant_id = ${tenantId}`
    : sql`INNER JOIN pipelines p
            ON p.id = jps.pipeline_id
           AND p.is_default = true
           AND p.tenant_id = ${tenantId}`;

  const rows = await db.execute(sql`
    SELECT
      jps.name AS stage_name,
      jps.label AS stage_label,
      jps.color AS stage_color,
      COUNT(j.id)::text AS job_count
    FROM job_pipeline_stages jps
    ${pipelineJoin}
    LEFT JOIN jobs j
      ON j.status = jps.name
      AND j.pipeline_id = jps.pipeline_id
      AND j.tenant_id = ${tenantId}
      AND j.archived_at IS NULL
    WHERE jps.tenant_id = ${tenantId}
    GROUP BY jps.name, jps.label, jps.color, jps.sort_order
    ORDER BY jps.sort_order
  `);
  return z.array(dashboardPipelineRow).parse(rows);
}
