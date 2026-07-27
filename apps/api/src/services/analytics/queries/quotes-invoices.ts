import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import { bucketSeries } from "./buckets.js";
import {
  quoteFunnelRow,
  statusCountRow,
  agingBucketRow,
  avgDaysRow,
  monthlyCountRow,
  quoteKpisRow,
  quoteKpisPrevRow,
  collectionRateRow,
  totalCountRow,
  totalAmountRow,
  overdueInvoiceRow,
  quoteSummaryRow,
} from "../schemas.js";

/**
 * Archived invoices and quotes are excluded everywhere in this file so the
 * numbers match the Invoices / Quotes list pages, which hide archived rows by
 * default. (`invoice_payments` is deliberately *not* filtered — see the note in
 * `revenue.ts`: archiving hides a document, it does not un-collect cash.)
 */
const NOT_ARCHIVED = sql`AND archived_at IS NULL`;

/**
 * `quotes.created_at` is `timestamptz`; a bare `::date` comparison resolves the
 * boundary in the session timezone (UTC), not the tenant's.
 */
const quoteCreatedLocal = (timezone: string) =>
  sql`((created_at AT TIME ZONE ${timezone})::date)`;

/** Quote conversion funnel by status. */
export async function getQuoteConversionFunnel(db: DbClient, params: DateRangeParams) {
  const { tenantId, timezone, rangeFrom, rangeTo } = params;
  const created = quoteCreatedLocal(timezone);
  const rows = await db.execute(sql`
    SELECT
      status,
      COUNT(*)::text AS count,
      COALESCE(SUM(total_amount::numeric), 0)::text AS value
    FROM quotes
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND ${created} >= ${rangeFrom}::date
      AND ${created} <= ${rangeTo}::date
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'sent' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'declined' THEN 3
        WHEN 'expired' THEN 4
        WHEN 'draft' THEN 5
      END
  `);
  return z.array(quoteFunnelRow).parse(rows);
}

/** Invoice status distribution in date range. */
export async function getInvoiceStatusDistribution(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT status, COUNT(*)::text AS count
    FROM invoices
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND issued_date >= ${rangeFrom}::date
      AND issued_date <= ${rangeTo}::date
    GROUP BY status
    ORDER BY COUNT(*) DESC
  `);
  return z.array(statusCountRow).parse(rows);
}

/**
 * Standard AR aging buckets: current / 1-30 / 31-60 / 61-90 / 90+.
 *
 * The previous version had no 61-90 bucket, so everything past 60 days landed in a
 * bucket *named* `90plus` — a contractor reading "90+" was seeing invoices as young
 * as 61 days. Buckets are computed live from `due_date`, which is also what
 * `getOverdueInvoiceSummary` uses, so the aging widget and the overdue banner can
 * never disagree.
 */
export async function getInvoiceAgingBuckets(
  db: DbClient,
  tenantId: string,
  timezone: string,
) {
  const rows = await db.execute(sql`
    SELECT bucket, COUNT(*)::text AS count, COALESCE(SUM(amount), 0)::text AS amount
    FROM (
      SELECT
        CASE
          WHEN due_date >= (now() AT TIME ZONE ${timezone})::date THEN 'current'
          WHEN due_date >= (now() AT TIME ZONE ${timezone})::date - 30 THEN '30'
          WHEN due_date >= (now() AT TIME ZONE ${timezone})::date - 60 THEN '60'
          WHEN due_date >= (now() AT TIME ZONE ${timezone})::date - 90 THEN '90'
          ELSE '90plus'
        END AS bucket,
        balance_due::numeric AS amount
      FROM invoices
      WHERE tenant_id = ${tenantId}
        ${NOT_ARCHIVED}
        AND status NOT IN ('paid', 'void')
    ) sub
    GROUP BY bucket
    ORDER BY CASE bucket
      WHEN 'current' THEN 1
      WHEN '30' THEN 2
      WHEN '60' THEN 3
      WHEN '90' THEN 4
      ELSE 5
    END
  `);
  return z.array(agingBucketRow).parse(rows);
}

/** Average days from invoice issued to payment. */
export async function getAvgDaysToPayment(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT COALESCE(
      AVG(ip.payment_date::date - i.issued_date),
      0
    )::text AS avg_days
    FROM invoice_payments ip
    INNER JOIN invoices i
      ON i.id = ip.invoice_id
     AND i.tenant_id = ${tenantId}
     AND i.archived_at IS NULL
    WHERE ip.tenant_id = ${tenantId}
      AND ip.payment_date >= ${rangeFrom}::date
      AND ip.payment_date <= ${rangeTo}::date
  `);
  return z.array(avgDaysRow).parse(rows);
}

/**
 * Overdue invoices bucketed by due date.
 *
 * "Overdue" is the same predicate as `getOverdueInvoiceSummary` — unpaid, not
 * void, past due in the tenant's timezone — not `status = 'overdue'`, which only
 * flips when the nightly cron runs. Using the stored status here meant the trend
 * and the overdue banner could disagree by however long the cron had been down.
 */
export async function getOverdueInvoiceTrend(
  db: DbClient,
  params: DateRangeParams,
  from = params.rangeFrom,
  to = params.rangeTo,
) {
  const { tenantId, timezone, granularity } = params;
  const b = bucketSeries(granularity, from, to);
  const rows = await db.execute(sql`
    SELECT
      ${b.key} AS month,
      ${b.label} AS month_label,
      COUNT(i.id)::text AS count
    FROM ${b.series}
    LEFT JOIN invoices i
      ON i.tenant_id = ${tenantId}
      AND i.archived_at IS NULL
      AND i.status NOT IN ('paid', 'void')
      AND i.due_date < (now() AT TIME ZONE ${timezone})::date
      AND i.due_date >= m.bucket
      AND i.due_date < m.bucket + ${b.step}
      AND i.due_date >= ${from}::date
      AND i.due_date <= ${to}::date
    GROUP BY m.bucket
    ORDER BY m.bucket
  `);
  return z.array(monthlyCountRow).parse(rows);
}

/** Quote KPIs (current period). Shared with dashboard. */
export async function getQuoteKpis(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  timezone: string,
) {
  const created = quoteCreatedLocal(timezone);
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COALESCE(SUM(total_amount::numeric), 0)::text AS total_value,
      COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted
    FROM quotes
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND ${created} >= ${from}::date
      AND ${created} <= ${to}::date
  `);
  return z.array(quoteKpisRow).parse(rows);
}

/** Quote KPIs (previous period, simpler). */
export async function getQuoteKpisPrev(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  timezone: string,
) {
  const created = quoteCreatedLocal(timezone);
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted
    FROM quotes
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND ${created} >= ${from}::date
      AND ${created} <= ${to}::date
  `);
  return z.array(quoteKpisPrevRow).parse(rows);
}

/** Invoice KPIs: total invoiced vs collected, for any date window. */
export async function getInvoiceKpis(
  db: DbClient,
  params: DateRangeParams,
  from = params.rangeFrom,
  to = params.rangeTo,
) {
  const { tenantId } = params;
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_amount::numeric), 0)::text AS invoiced,
      COALESCE(SUM(amount_paid::numeric), 0)::text AS collected
    FROM invoices
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND status != 'void'
      AND issued_date >= ${from}::date
      AND issued_date <= ${to}::date
  `);
  return z.array(collectionRateRow).parse(rows);
}

/**
 * Overdue invoices summary (count + amount). Shared with dashboard.
 *
 * Overdue is derived from `due_date`, NOT from `status = 'overdue'`. The stored
 * status only flips when the overdue cron runs, so an invoice ten days past due
 * could still read `sent` — it would appear in the aging widget's "1-30 days"
 * bucket while being absent from this banner. Keep the stored status for email
 * triggers; every read-side "is this overdue" question resolves here.
 */
export async function getOverdueInvoiceSummary(
  db: DbClient,
  tenantId: string,
  timezone: string,
) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COALESCE(SUM(balance_due::numeric), 0)::text AS amount
    FROM invoices
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND status NOT IN ('paid', 'void')
      AND due_date < (now() AT TIME ZONE ${timezone})::date
  `);
  return z.array(overdueInvoiceRow).parse(rows);
}

/** Quote summary with status breakdown. Shared with dashboard. */
export async function getQuoteSummary(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
  timezone: string,
) {
  const created = quoteCreatedLocal(timezone);
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total_quotes,
      COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
      COUNT(*) FILTER (WHERE status = 'declined')::text AS declined,
      COUNT(*) FILTER (WHERE status IN ('draft', 'sent'))::text AS pending
    FROM quotes
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND ${created} >= ${from}::date
      AND ${created} <= ${to}::date
  `);
  return z.array(quoteSummaryRow).parse(rows);
}
