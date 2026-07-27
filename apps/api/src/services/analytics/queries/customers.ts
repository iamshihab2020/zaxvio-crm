import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import { bucketSeries } from "./buckets.js";
import {
  monthlyCountRow,
  activeInactiveRow,
  topCustomerJobsRow,
  repeatOneTimeRow,
  totalCountRow,
  retentionTrendRow,
} from "../schemas.js";

/**
 * `customers.created_at` is `timestamptz`. Comparing it against a bare `::date`
 * resolves the boundary in the *session* timezone (UTC on Neon), so a customer
 * created at 8pm Central on the last day of a range landed in the next day's
 * bucket. Converting to the tenant's local date first makes every boundary agree
 * with what the contractor sees on the Customers page.
 */
const customerCreatedLocal = (timezone: string) =>
  sql`((c.created_at AT TIME ZONE ${timezone})::date)`;
const createdLocal = (timezone: string) =>
  sql`((created_at AT TIME ZONE ${timezone})::date)`;

/** New customers per bucket with generate_series zero-fill, clamped to [from, to]. */
export async function getNewCustomersTrend(
  db: DbClient,
  params: DateRangeParams,
  from = params.rangeFrom,
  to = params.rangeTo,
) {
  const { tenantId, timezone, granularity } = params;
  const b = bucketSeries(granularity, from, to);
  const created = customerCreatedLocal(timezone);
  const rows = await db.execute(sql`
    SELECT
      ${b.key} AS month,
      ${b.label} AS month_label,
      COUNT(c.id)::text AS count
    FROM ${b.series}
    LEFT JOIN customers c
      ON c.tenant_id = ${tenantId}
      AND c.archived_at IS NULL
      AND ${created} >= m.bucket
      AND ${created} < m.bucket + ${b.step}
      AND ${created} >= ${from}::date
      AND ${created} <= ${to}::date
    GROUP BY m.bucket
    ORDER BY m.bucket
  `);
  return z.array(monthlyCountRow).parse(rows);
}

/**
 * Active vs inactive customer counts. Shared with dashboard.
 *
 * "Active" means a job scheduled in the trailing 90 tenant-local days — the
 * boundary was `CURRENT_DATE` (session timezone = UTC), which flipped the split
 * a day early for a US Central tenant. Both halves exclude archived rows so
 * `active + inactive` equals the Customers page total.
 */
export async function getActiveVsInactiveCustomers(
  db: DbClient,
  tenantId: string,
  timezone: string,
) {
  const rows = await db.execute(sql`
    WITH total AS (
      SELECT COUNT(*)::int AS cnt
      FROM customers
      WHERE tenant_id = ${tenantId}
        AND archived_at IS NULL
    ),
    active AS (
      SELECT COUNT(DISTINCT j.customer_id)::int AS cnt
      FROM jobs j
      INNER JOIN customers c
        ON c.id = j.customer_id
       AND c.tenant_id = ${tenantId}
       AND c.archived_at IS NULL
      WHERE j.tenant_id = ${tenantId}
        AND j.archived_at IS NULL
        AND j.scheduled_date >= (now() AT TIME ZONE ${timezone})::date - INTERVAL '90 days'
    )
    SELECT
      active.cnt::text AS active,
      GREATEST(total.cnt - active.cnt, 0)::text AS inactive
    FROM total, active
  `);
  return z.array(activeInactiveRow).parse(rows);
}

/** Top 10 customers by job count. */
export async function getTopCustomersByJobCount(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.first_name || ' ' || c.last_name AS name,
      COUNT(j.id)::text AS job_count,
      COALESCE(SUM(j.total_amount::numeric), 0)::text AS total_spent
    FROM customers c
    LEFT JOIN jobs j
      ON j.customer_id = c.id
     AND j.tenant_id = ${tenantId}
     AND j.archived_at IS NULL
    WHERE c.tenant_id = ${tenantId}
      AND c.archived_at IS NULL
    GROUP BY c.id, c.first_name, c.last_name
    HAVING COUNT(j.id) > 0
    ORDER BY COUNT(j.id) DESC
    LIMIT 10
  `);
  return z.array(topCustomerJobsRow).parse(rows);
}

/** Repeat (>1 job) vs one-time (1 job) customers. */
export async function getRepeatVsOneTime(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    WITH job_counts AS (
      SELECT j.customer_id, COUNT(*)::int AS cnt
      FROM jobs j
      INNER JOIN customers c
        ON c.id = j.customer_id
       AND c.tenant_id = ${tenantId}
       AND c.archived_at IS NULL
      WHERE j.tenant_id = ${tenantId}
        AND j.archived_at IS NULL
      GROUP BY j.customer_id
    )
    SELECT
      COUNT(*) FILTER (WHERE cnt > 1)::text AS repeat_count,
      COUNT(*) FILTER (WHERE cnt = 1)::text AS onetime_count
    FROM job_counts
  `);
  return z.array(repeatOneTimeRow).parse(rows);
}

/** New-customer count in a date range, bounded on tenant-local calendar days. */
export async function getCustomerCount(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  timezone: string,
) {
  const created = createdLocal(timezone);
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM customers
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND ${created} >= ${from}::date
      AND ${created} <= ${to}::date
  `);
  return z.array(totalCountRow).parse(rows);
}

/** Active customer count (distinct customers with jobs in last 90 tenant-local days). */
export async function getActiveCustomerCount(
  db: DbClient,
  tenantId: string,
  timezone: string,
) {
  const rows = await db.execute(sql`
    SELECT COUNT(DISTINCT customer_id)::text AS total
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND scheduled_date >= (now() AT TIME ZONE ${timezone})::date - INTERVAL '90 days'
  `);
  return z.array(totalCountRow).parse(rows);
}

/**
 * Monthly repeat-customer rate: % of customers with ≥2 completed jobs whose latest job falls in the bucket.
 * Each row is a month bucket; repeat_count = customers with ≥2 total jobs (lifetime) that had a job this month;
 * total_count = distinct customers who had any job this month.
 */
export async function getRepeatCustomerRateByMonth(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    WITH lifetime AS (
      SELECT customer_id, COUNT(*)::int AS total_jobs
      FROM jobs
      WHERE tenant_id = ${tenantId}
        AND archived_at IS NULL
      GROUP BY customer_id
    ),
    monthly AS (
      SELECT
        date_trunc('month', j.scheduled_date)::date AS bucket,
        j.customer_id,
        (l.total_jobs > 1) AS is_repeat
      FROM jobs j
      INNER JOIN lifetime l ON l.customer_id = j.customer_id
      WHERE j.tenant_id = ${tenantId}
        AND j.archived_at IS NULL
        AND j.scheduled_date >= ${from}::date
        AND j.scheduled_date <= ${to}::date
    )
    SELECT
      to_char(m.bucket, 'YYYY-MM') AS month,
      to_char(m.bucket, 'Mon YYYY') AS month_label,
      COALESCE(COUNT(DISTINCT CASE WHEN monthly.is_repeat THEN monthly.customer_id END), 0)::text AS repeat_count,
      COALESCE(COUNT(DISTINCT monthly.customer_id), 0)::text AS total_count
    FROM generate_series(
      date_trunc('month', ${from}::date),
      date_trunc('month', ${to}::date),
      INTERVAL '1 month'
    ) AS m(bucket)
    LEFT JOIN monthly ON monthly.bucket = m.bucket
    GROUP BY m.bucket
    ORDER BY m.bucket
  `);
  return z.array(retentionTrendRow).parse(rows);
}

/** Total customer count (all time, excluding archived — matches the Customers page). */
export async function getTotalCustomerCount(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM customers
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
  `);
  return z.array(totalCountRow).parse(rows);
}
