import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
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

/** Quote conversion funnel by status. */
export async function getQuoteConversionFunnel(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      status,
      COUNT(*)::text AS count,
      COALESCE(SUM(total_amount::numeric), 0)::text AS value
    FROM quotes
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${rangeFrom}::date
      AND created_at <= ${rangeTo}::date + INTERVAL '1 day'
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
      AND issued_date >= ${rangeFrom}::date
      AND issued_date <= ${rangeTo}::date
    GROUP BY status
    ORDER BY COUNT(*) DESC
  `);
  return z.array(statusCountRow).parse(rows);
}

/** Invoice aging buckets. Shared with dashboard. */
export async function getInvoiceAgingBuckets(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT bucket, COUNT(*)::text AS count, COALESCE(SUM(amount), 0)::text AS amount
    FROM (
      SELECT
        CASE
          WHEN due_date >= CURRENT_DATE THEN 'current'
          WHEN due_date >= CURRENT_DATE - 30 THEN '30'
          WHEN due_date >= CURRENT_DATE - 60 THEN '60'
          ELSE '90plus'
        END AS bucket,
        balance_due::numeric AS amount
      FROM invoices
      WHERE tenant_id = ${tenantId}
        AND status NOT IN ('paid', 'void')
    ) sub
    GROUP BY bucket
    ORDER BY CASE bucket
      WHEN 'current' THEN 1
      WHEN '30' THEN 2
      WHEN '60' THEN 3
      ELSE 4
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
    INNER JOIN invoices i ON i.id = ip.invoice_id AND i.tenant_id = ${tenantId}
    WHERE ip.tenant_id = ${tenantId}
      AND ip.payment_date >= ${rangeFrom}::date
      AND ip.payment_date <= ${rangeTo}::date
  `);
  return z.array(avgDaysRow).parse(rows);
}

/** Overdue invoice trend by month. */
export async function getOverdueInvoiceTrend(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      to_char(m.month, 'Mon YYYY') AS month_label,
      COUNT(i.id)::text AS count
    FROM generate_series(
      date_trunc('month', ${rangeFrom}::date),
      date_trunc('month', ${rangeTo}::date),
      INTERVAL '1 month'
    ) AS m(month)
    LEFT JOIN invoices i
      ON i.tenant_id = ${tenantId}
      AND i.status = 'overdue'
      AND i.due_date >= m.month
      AND i.due_date < m.month + INTERVAL '1 month'
    GROUP BY m.month
    ORDER BY m.month
  `);
  return z.array(monthlyCountRow).parse(rows);
}

/** Quote KPIs (current period). Shared with dashboard. */
export async function getQuoteKpis(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COALESCE(SUM(total_amount::numeric), 0)::text AS total_value,
      COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted
    FROM quotes
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${from}::date
      AND created_at <= ${to}::date + INTERVAL '1 day'
  `);
  return z.array(quoteKpisRow).parse(rows);
}

/** Quote KPIs (previous period, simpler). */
export async function getQuoteKpisPrev(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted
    FROM quotes
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${from}::date
      AND created_at <= ${to}::date + INTERVAL '1 day'
  `);
  return z.array(quoteKpisPrevRow).parse(rows);
}

/** Invoice KPIs: total invoiced vs collected. */
export async function getInvoiceKpis(db: DbClient, params: DateRangeParams) {
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

/** Open (non-paid, non-void) invoice count. Shared with dashboard. */
export async function getOpenInvoiceCount(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status NOT IN ('paid', 'void')
      AND issued_date >= ${from}::date
      AND issued_date <= ${to}::date
  `);
  return z.array(totalCountRow).parse(rows);
}

/** Outstanding balance (SUM balance_due). Shared with dashboard. */
export async function getOutstandingBalance(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(balance_due::numeric), 0)::text AS amount
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status NOT IN ('paid', 'void')
      AND issued_date >= ${from}::date
      AND issued_date <= ${to}::date
  `);
  return z.array(totalAmountRow).parse(rows);
}

/** Overdue invoices summary (count + amount). Shared with dashboard. */
export async function getOverdueInvoiceSummary(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COALESCE(SUM(balance_due::numeric), 0)::text AS amount
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status = 'overdue'
  `);
  return z.array(overdueInvoiceRow).parse(rows);
}

/** Quote summary with status breakdown. Shared with dashboard. */
export async function getQuoteSummary(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total_quotes,
      COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
      COUNT(*) FILTER (WHERE status = 'declined')::text AS declined,
      COUNT(*) FILTER (WHERE status IN ('draft', 'sent'))::text AS pending
    FROM quotes
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${from}::date
      AND created_at <= ${to}::date + INTERVAL '1 day'
  `);
  return z.array(quoteSummaryRow).parse(rows);
}
