import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import {
  revenueTrendRow,
  revenueByServiceTypeRow,
  revenueByPaymentMethodRow,
  avgJobValueRow,
  collectionRateRow,
  topCustomerRevenueRow,
  totalAmountRow,
} from "../schemas.js";

/**
 * Revenue trend with configurable granularity (day/week/month) and generate_series zero-fill.
 * Returns rows keyed by the bucket's starting date.
 */
export async function getRevenueTrend(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  granularity: "day" | "week" | "month" = "month",
) {
  if (granularity === "day") {
    const rows = await db.execute(sql`
      SELECT
        to_char(m.bucket, 'YYYY-MM-DD') AS month,
        to_char(m.bucket, 'Mon DD') AS month_label,
        COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
      FROM generate_series(
        date_trunc('day', ${from}::date),
        date_trunc('day', ${to}::date),
        INTERVAL '1 day'
      ) AS m(bucket)
      LEFT JOIN invoice_payments ip
        ON ip.tenant_id = ${tenantId}
        AND ip.payment_date >= m.bucket
        AND ip.payment_date < m.bucket + INTERVAL '1 day'
      GROUP BY m.bucket
      ORDER BY m.bucket
    `);
    return z.array(revenueTrendRow).parse(rows);
  }
  if (granularity === "week") {
    const rows = await db.execute(sql`
      SELECT
        to_char(m.bucket, 'YYYY-MM-DD') AS month,
        to_char(m.bucket, '"W"IW YYYY') AS month_label,
        COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
      FROM generate_series(
        date_trunc('week', ${from}::date),
        date_trunc('week', ${to}::date),
        INTERVAL '1 week'
      ) AS m(bucket)
      LEFT JOIN invoice_payments ip
        ON ip.tenant_id = ${tenantId}
        AND ip.payment_date >= m.bucket
        AND ip.payment_date < m.bucket + INTERVAL '1 week'
      GROUP BY m.bucket
      ORDER BY m.bucket
    `);
    return z.array(revenueTrendRow).parse(rows);
  }
  return getRevenueTrendByMonth(db, tenantId, from, to);
}

/** Monthly revenue trend with generate_series zero-fill. */
export async function getRevenueTrendByMonth(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      to_char(m.month, 'Mon YYYY') AS month_label,
      COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
    FROM generate_series(
      date_trunc('month', ${from}::date),
      date_trunc('month', ${to}::date),
      INTERVAL '1 month'
    ) AS m(month)
    LEFT JOIN invoice_payments ip
      ON ip.tenant_id = ${tenantId}
      AND ip.payment_date >= m.month
      AND ip.payment_date < m.month + INTERVAL '1 month'
    GROUP BY m.month
    ORDER BY m.month
  `);
  return z.array(revenueTrendRow).parse(rows);
}

/** Total revenue (SUM of invoice_payments) for a date range. Shared with dashboard. */
export async function getRevenueTotal(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(amount::numeric), 0)::text AS amount
    FROM invoice_payments
    WHERE tenant_id = ${tenantId}
      AND payment_date >= ${from}::date
      AND payment_date <= ${to}::date
  `);
  return z.array(totalAmountRow).parse(rows);
}

/** Revenue grouped by job service type. */
export async function getRevenueByServiceType(
  db: DbClient,
  params: DateRangeParams,
) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      j.service_type,
      COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
    FROM invoice_payments ip
    INNER JOIN invoices i ON i.id = ip.invoice_id AND i.tenant_id = ${tenantId}
    INNER JOIN jobs j ON j.id = i.job_id AND j.tenant_id = ${tenantId}
    WHERE ip.tenant_id = ${tenantId}
      AND ip.payment_date >= ${rangeFrom}::date
      AND ip.payment_date <= ${rangeTo}::date
    GROUP BY j.service_type
    ORDER BY SUM(ip.amount::numeric) DESC
  `);
  return z.array(revenueByServiceTypeRow).parse(rows);
}

/** Revenue grouped by payment method. */
export async function getRevenueByPaymentMethod(
  db: DbClient,
  params: DateRangeParams,
) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      payment_method AS method,
      COALESCE(SUM(amount::numeric), 0)::text AS amount
    FROM invoice_payments
    WHERE tenant_id = ${tenantId}
      AND payment_date >= ${rangeFrom}::date
      AND payment_date <= ${rangeTo}::date
    GROUP BY payment_method
    ORDER BY SUM(amount::numeric) DESC
  `);
  return z.array(revenueByPaymentMethodRow).parse(rows);
}

/** Average job value by month with generate_series zero-fill. */
export async function getAvgJobValueTrend(
  db: DbClient,
  params: DateRangeParams,
) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      to_char(m.month, 'Mon YYYY') AS month_label,
      COALESCE(AVG(j.total_amount::numeric), 0)::text AS avg_value
    FROM generate_series(
      date_trunc('month', ${rangeFrom}::date),
      date_trunc('month', ${rangeTo}::date),
      INTERVAL '1 month'
    ) AS m(month)
    LEFT JOIN jobs j
      ON j.tenant_id = ${tenantId}
      AND j.status != 'cancelled'
      AND j.scheduled_date >= m.month
      AND j.scheduled_date < m.month + INTERVAL '1 month'
    GROUP BY m.month
    ORDER BY m.month
  `);
  return z.array(avgJobValueRow).parse(rows);
}

/** Collection rate: total invoiced vs total collected. */
export async function getCollectionRate(
  db: DbClient,
  params: DateRangeParams,
) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_amount::numeric), 0)::text AS invoiced,
      COALESCE(SUM(amount_paid::numeric), 0)::text AS collected
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status != 'void'
      AND issued_date >= ${rangeFrom}::date
      AND issued_date <= ${rangeTo}::date
  `);
  return z.array(collectionRateRow).parse(rows);
}

/** Top 10 customers by revenue in date range. */
export async function getTopCustomersByRevenue(
  db: DbClient,
  params: DateRangeParams,
) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.first_name || ' ' || c.last_name AS name,
      COALESCE(SUM(ip.amount::numeric), 0)::text AS revenue,
      COUNT(DISTINCT i.job_id)::text AS job_count
    FROM invoice_payments ip
    INNER JOIN invoices i ON i.id = ip.invoice_id AND i.tenant_id = ${tenantId}
    INNER JOIN customers c ON c.id = i.customer_id AND c.tenant_id = ${tenantId}
    WHERE ip.tenant_id = ${tenantId}
      AND ip.payment_date >= ${rangeFrom}::date
      AND ip.payment_date <= ${rangeTo}::date
    GROUP BY c.id, c.first_name, c.last_name
    ORDER BY SUM(ip.amount::numeric) DESC
    LIMIT 10
  `);
  return z.array(topCustomerRevenueRow).parse(rows);
}
