import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import {
  monthlyCountRow,
  activeInactiveRow,
  topCustomerJobsRow,
  repeatOneTimeRow,
  totalCountRow,
} from "../schemas.js";

/** New customers by month with generate_series zero-fill. */
export async function getNewCustomersTrend(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      to_char(m.month, 'Mon YYYY') AS month_label,
      COUNT(c.id)::text AS count
    FROM generate_series(
      date_trunc('month', ${rangeFrom}::date),
      date_trunc('month', ${rangeTo}::date),
      INTERVAL '1 month'
    ) AS m(month)
    LEFT JOIN customers c
      ON c.tenant_id = ${tenantId}
      AND c.created_at >= m.month
      AND c.created_at < m.month + INTERVAL '1 month'
    GROUP BY m.month
    ORDER BY m.month
  `);
  return z.array(monthlyCountRow).parse(rows);
}

/** Active vs inactive customer counts. Shared with dashboard. */
export async function getActiveVsInactiveCustomers(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    WITH total AS (
      SELECT COUNT(*)::int AS cnt FROM customers WHERE tenant_id = ${tenantId}
    ),
    active AS (
      SELECT COUNT(DISTINCT customer_id)::int AS cnt
      FROM jobs
      WHERE tenant_id = ${tenantId}
        AND scheduled_date >= CURRENT_DATE - INTERVAL '90 days'
    )
    SELECT
      active.cnt::text AS active,
      (total.cnt - active.cnt)::text AS inactive
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
    LEFT JOIN jobs j ON j.customer_id = c.id AND j.tenant_id = ${tenantId}
    WHERE c.tenant_id = ${tenantId}
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
      SELECT customer_id, COUNT(*)::int AS cnt
      FROM jobs
      WHERE tenant_id = ${tenantId}
      GROUP BY customer_id
    )
    SELECT
      COUNT(*) FILTER (WHERE cnt > 1)::text AS repeat_count,
      COUNT(*) FILTER (WHERE cnt = 1)::text AS onetime_count
    FROM job_counts
  `);
  return z.array(repeatOneTimeRow).parse(rows);
}

/** Customer count in date range. */
export async function getCustomerCount(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM customers
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${from}::date
      AND created_at <= ${to}::date + INTERVAL '1 day'
  `);
  return z.array(totalCountRow).parse(rows);
}

/** Active customer count (distinct customers with jobs in last 90 days). Shared with dashboard. */
export async function getActiveCustomerCount(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT COUNT(DISTINCT customer_id)::text AS total
    FROM jobs
    WHERE tenant_id = ${tenantId}
      AND scheduled_date >= CURRENT_DATE - INTERVAL '90 days'
  `);
  return z.array(totalCountRow).parse(rows);
}

/** Total customer count (all time). */
export async function getTotalCustomerCount(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM customers
    WHERE tenant_id = ${tenantId}
  `);
  return z.array(totalCountRow).parse(rows);
}
