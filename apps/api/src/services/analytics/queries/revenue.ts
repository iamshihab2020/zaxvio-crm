import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams, TrendGranularity } from "../types.js";
import { bucketSeries } from "./buckets.js";
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
 * Money already received is never retroactively removed: payment-sourced queries
 * in this file deliberately carry no `archived_at` filter. Archiving an invoice
 * hides it from the list page; it does not un-collect the cash. Entity-sourced
 * metrics (job values, invoice counts) *do* exclude archived rows.
 */

/**
 * Revenue trend with configurable granularity (day/week/month) and generate_series zero-fill.
 * Returns rows keyed by the bucket's starting date.
 *
 * The payment join is clamped to `[from, to]` as well as to the bucket.
 * `date_trunc` snaps the first bucket backwards (a week bucket can start up to 6 days
 * before `from`) and the last bucket forwards, so without the clamp the chart would
 * include revenue outside the requested window and stop summing to the headline
 * figure produced by `getRevenueTotal`.
 */
export async function getRevenueTrend(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  granularity: TrendGranularity = "month",
) {
  const b = bucketSeries(granularity, from, to);
  const rows = await db.execute(sql`
    SELECT
      ${b.key} AS month,
      ${b.label} AS month_label,
      COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
    FROM ${b.series}
    LEFT JOIN invoice_payments ip
      ON ip.tenant_id = ${tenantId}
      AND ip.payment_date >= m.bucket
      AND ip.payment_date < m.bucket + ${b.step}
      AND ip.payment_date >= ${from}::date
      AND ip.payment_date <= ${to}::date
    GROUP BY m.bucket
    ORDER BY m.bucket
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

/**
 * What was *billed* per bucket, on the same series as `getRevenueTrend`.
 *
 * Deliberately a different event from revenue: revenue is cash received on a
 * payment date, this is the face value of invoices issued. Charting them
 * together is what makes the collection gap visible — and both are dollars, so
 * they share one axis.
 *
 * `BILLED_FILTER` is the single definition of "billed" for the whole file:
 * a draft has never been sent to anyone and a void invoice was withdrawn, so
 * neither is money anybody owes. Every query using it aliases the table `i`, so
 * the fragment can qualify its columns and never bind to the wrong relation.
 */
const BILLED_FILTER = sql`i.archived_at IS NULL AND i.status NOT IN ('draft', 'void')`;

export async function getInvoicedTrend(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  granularity: TrendGranularity = "month",
) {
  const b = bucketSeries(granularity, from, to);
  const rows = await db.execute(sql`
    SELECT
      ${b.key} AS month,
      ${b.label} AS month_label,
      COALESCE(SUM(i.total_amount::numeric), 0)::text AS amount
    FROM ${b.series}
    LEFT JOIN invoices i
      ON i.tenant_id = ${tenantId}
      AND ${BILLED_FILTER}
      AND i.issued_date >= m.bucket
      AND i.issued_date < m.bucket + ${b.step}
      AND i.issued_date >= ${from}::date
      AND i.issued_date <= ${to}::date
    GROUP BY m.bucket
    ORDER BY m.bucket
  `);
  return z.array(revenueTrendRow).parse(rows);
}

/** Total billed in a date range — the headline figure beside collected revenue. */
export async function getInvoicedTotal(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(i.total_amount::numeric), 0)::text AS amount
    FROM invoices i
    WHERE i.tenant_id = ${tenantId}
      AND ${BILLED_FILTER}
      AND i.issued_date >= ${from}::date
      AND i.issued_date <= ${to}::date
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

/**
 * Average *booked* job value per bucket (`jobs.total_amount`), zero-filled.
 *
 * Not the same measure as `getRevenueTrend`, which sums cash received. Archived
 * and cancelled jobs are excluded so this matches the Jobs page, and the join is
 * clamped to `[from, to]` for the same bucket-overhang reason as the revenue trend.
 */
export async function getAvgJobValueTrend(
  db: DbClient,
  params: DateRangeParams,
  from = params.rangeFrom,
  to = params.rangeTo,
) {
  const { tenantId, granularity } = params;
  const b = bucketSeries(granularity, from, to);
  const rows = await db.execute(sql`
    SELECT
      ${b.key} AS month,
      ${b.label} AS month_label,
      COALESCE(AVG(j.total_amount::numeric), 0)::text AS avg_value
    FROM ${b.series}
    LEFT JOIN jobs j
      ON j.tenant_id = ${tenantId}
      AND j.archived_at IS NULL
      AND j.status != 'cancelled'
      AND j.scheduled_date >= m.bucket
      AND j.scheduled_date < m.bucket + ${b.step}
      AND j.scheduled_date >= ${from}::date
      AND j.scheduled_date <= ${to}::date
    GROUP BY m.bucket
    ORDER BY m.bucket
  `);
  return z.array(avgJobValueRow).parse(rows);
}

/**
 * Collection rate: total invoiced vs total collected, for any date window.
 *
 * Shares `BILLED_FILTER` with the billed trend, so /reports and /dashboard
 * cannot disagree about what counts as invoiced. It previously excluded only
 * void invoices, which put unsent **drafts** into the denominator and reported
 * a collection rate lower than the business had actually failed to collect.
 */
export async function getCollectionRate(
  db: DbClient,
  params: DateRangeParams,
  from = params.rangeFrom,
  to = params.rangeTo,
) {
  const { tenantId } = params;
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(i.total_amount::numeric), 0)::text AS invoiced,
      COALESCE(SUM(i.amount_paid::numeric), 0)::text AS collected
    FROM invoices i
    WHERE i.tenant_id = ${tenantId}
      AND ${BILLED_FILTER}
      AND i.issued_date >= ${from}::date
      AND i.issued_date <= ${to}::date
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
