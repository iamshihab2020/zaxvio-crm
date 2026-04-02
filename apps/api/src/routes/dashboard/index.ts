import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb, sql } from "@hvac-saas/database";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireTenant);

  // GET /dashboard/stats — all KPI data in one response
  fastify.get("/stats", async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;

    // Parse optional date range from query params
    const query = request.query as { from?: string; to?: string };
    const now = new Date();
    const rangeFrom = query.from ?? formatDate(startOfMonth(now));
    const rangeTo = query.to ?? formatDate(now);

    // Compute previous period (same duration before rangeFrom)
    const fromDate = new Date(rangeFrom);
    const toDate = new Date(rangeTo);
    const durationMs = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - 1); // day before rangeFrom
    const prevFrom = new Date(prevTo.getTime() - durationMs);
    const prevFromStr = formatDate(prevFrom);
    const prevToStr = formatDate(prevTo);

    const [
      jobsTodayResult,
      openInvoicesResult,
      outstandingBalanceResult,
      thisMonthRevenueResult,
      activeCustomersResult,
      upcomingBookingsResult,
      overdueInvoicesResult,
      jobPipelineResult,
      revenueTrendResult,
      recentActivityResult,
      // New queries for trends + widgets
      prevRevenueResult,
      prevOpenInvoicesResult,
      prevOutstandingResult,
      yesterdayJobsResult,
      todayScheduleResult,
      invoiceAgingResult,
      quoteSummaryResult,
      weeklyJobVolumeResult,
      weeklyRevenueResult,
    ] = await Promise.all([
      // 1. Jobs Today + emergency count
      db.execute<{ total: string; emergency: string }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE priority = 'emergency')::text AS emergency
        FROM jobs
        WHERE tenant_id = ${tenantId}
          AND scheduled_date = CURRENT_DATE
      `),

      // 2. Open Invoices count (within date range)
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status NOT IN ('paid', 'void')
          AND issued_date >= ${rangeFrom}::date
          AND issued_date <= ${rangeTo}::date
      `),

      // 3. Outstanding Balance (within date range)
      db.execute<{ amount: string }>(sql`
        SELECT COALESCE(SUM(balance_due::numeric), 0)::text AS amount
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status NOT IN ('paid', 'void')
          AND issued_date >= ${rangeFrom}::date
          AND issued_date <= ${rangeTo}::date
      `),

      // 4. Revenue in date range
      db.execute<{ amount: string }>(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::text AS amount
        FROM invoice_payments
        WHERE tenant_id = ${tenantId}
          AND payment_date >= ${rangeFrom}::date
          AND payment_date <= ${rangeTo}::date
      `),

      // 5. Active Customers (job in last 90 days — always current)
      db.execute<{ total: string }>(sql`
        SELECT COUNT(DISTINCT customer_id)::text AS total
        FROM jobs
        WHERE tenant_id = ${tenantId}
          AND scheduled_date >= CURRENT_DATE - INTERVAL '90 days'
      `),

      // 6. Upcoming Bookings (always current)
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM bookings
        WHERE tenant_id = ${tenantId}
          AND status = 'pending'
      `),

      // 7. Overdue Invoices (always current)
      db.execute<{ total: string; amount: string }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COALESCE(SUM(balance_due::numeric), 0)::text AS amount
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status = 'overdue'
      `),

      // 8. Job Pipeline (jobs grouped by pipeline stage — default pipeline)
      db.execute<{
        stage_name: string;
        stage_label: string;
        stage_color: string;
        job_count: string;
      }>(sql`
        SELECT
          jps.name AS stage_name,
          jps.label AS stage_label,
          jps.color AS stage_color,
          COUNT(j.id)::text AS job_count
        FROM job_pipeline_stages jps
        INNER JOIN pipelines p ON p.id = jps.pipeline_id AND p.is_default = true
        LEFT JOIN jobs j
          ON j.status = jps.name AND j.pipeline_id = jps.pipeline_id
        WHERE jps.tenant_id = ${tenantId}
        GROUP BY jps.name, jps.label, jps.color, jps.sort_order
        ORDER BY jps.sort_order
      `),

      // 9. Revenue Trend (last 6 months)
      db.execute<{
        month: string;
        month_label: string;
        amount: string;
      }>(sql`
        SELECT
          to_char(m.month, 'YYYY-MM') AS month,
          to_char(m.month, 'Mon') AS month_label,
          COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m(month)
        LEFT JOIN invoice_payments ip
          ON ip.tenant_id = ${tenantId}
          AND ip.payment_date >= m.month
          AND ip.payment_date < m.month + INTERVAL '1 month'
        GROUP BY m.month
        ORDER BY m.month
      `),

      // 10. Recent Activity (last 10 from jobs + quotes)
      db.execute<{
        id: string;
        type: string;
        action: string;
        description: string;
        entity_id: string;
        entity_label: string;
        created_at: string;
      }>(sql`
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
          LIMIT 10
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
          LIMIT 10
        )
        ORDER BY created_at DESC
        LIMIT 10
      `),

      // 11. Previous period revenue (for trend)
      db.execute<{ amount: string }>(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::text AS amount
        FROM invoice_payments
        WHERE tenant_id = ${tenantId}
          AND payment_date >= ${prevFromStr}::date
          AND payment_date <= ${prevToStr}::date
      `),

      // 12. Previous period open invoices count (for trend)
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status NOT IN ('paid', 'void')
          AND issued_date >= ${prevFromStr}::date
          AND issued_date <= ${prevToStr}::date
      `),

      // 13. Previous period outstanding balance (for trend)
      db.execute<{ amount: string }>(sql`
        SELECT COALESCE(SUM(balance_due::numeric), 0)::text AS amount
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status NOT IN ('paid', 'void')
          AND issued_date >= ${prevFromStr}::date
          AND issued_date <= ${prevToStr}::date
      `),

      // 14. Yesterday's job count (for jobs today trend)
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM jobs
        WHERE tenant_id = ${tenantId}
          AND scheduled_date = CURRENT_DATE - 1
      `),

      // 15. Today's schedule
      db.execute<{
        id: string;
        job_number: string;
        customer_name: string;
        scheduled_start: string | null;
        scheduled_end: string | null;
        status: string;
        priority: string;
        service_type: string;
      }>(sql`
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
        LIMIT 20
      `),

      // 16. Invoice aging buckets (always current)
      db.execute<{
        bucket: string;
        count: string;
        amount: string;
      }>(sql`
        SELECT
          CASE
            WHEN due_date >= CURRENT_DATE THEN 'current'
            WHEN due_date >= CURRENT_DATE - 30 THEN '30'
            WHEN due_date >= CURRENT_DATE - 60 THEN '60'
            ELSE '90plus'
          END AS bucket,
          COUNT(*)::text AS count,
          COALESCE(SUM(balance_due::numeric), 0)::text AS amount
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status NOT IN ('paid', 'void')
        GROUP BY 1
      `),

      // 17. Quote summary (within date range)
      db.execute<{
        total_quotes: string;
        accepted: string;
        declined: string;
        pending: string;
      }>(sql`
        SELECT
          COUNT(*)::text AS total_quotes,
          COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
          COUNT(*) FILTER (WHERE status = 'declined')::text AS declined,
          COUNT(*) FILTER (WHERE status IN ('draft', 'sent'))::text AS pending
        FROM quotes
        WHERE tenant_id = ${tenantId}
          AND created_at >= ${rangeFrom}::date
          AND created_at <= ${rangeTo}::date + INTERVAL '1 day'
      `),

      // 18. Weekly job volume (last 7 days, for sparkline — always current)
      db.execute<{ day: string; count: string }>(sql`
        SELECT
          d.day::date::text AS day,
          COUNT(j.id)::text AS count
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN jobs j ON j.tenant_id = ${tenantId} AND j.scheduled_date = d.day
        GROUP BY d.day
        ORDER BY d.day
      `),

      // 19. Weekly revenue (last 7 days, for sparkline — always current)
      db.execute<{ day: string; amount: string }>(sql`
        SELECT
          d.day::date::text AS day,
          COALESCE(SUM(ip.amount::numeric), 0)::text AS amount
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN invoice_payments ip ON ip.tenant_id = ${tenantId} AND ip.payment_date::date = d.day
        GROUP BY d.day
        ORDER BY d.day
      `),
    ]);

    // Parse results
    const jobsToday = jobsTodayResult[0];
    const openInvoices = openInvoicesResult[0];
    const outstandingBalance = outstandingBalanceResult[0];
    const thisMonthRevenue = thisMonthRevenueResult[0];
    const activeCustomers = activeCustomersResult[0];
    const upcomingBookings = upcomingBookingsResult[0];
    const overdueInvoices = overdueInvoicesResult[0];
    const prevRevenue = prevRevenueResult[0];
    const prevOpenInvoices = prevOpenInvoicesResult[0];
    const prevOutstanding = prevOutstandingResult[0];
    const yesterdayJobs = yesterdayJobsResult[0];
    const quoteSummaryRow = quoteSummaryResult[0];

    const totalQuotes = parseInt(quoteSummaryRow?.total_quotes ?? "0", 10);
    const accepted = parseInt(quoteSummaryRow?.accepted ?? "0", 10);

    return {
      data: {
        kpis: {
          jobsToday: {
            count: parseInt(jobsToday?.total ?? "0", 10),
            emergencyCount: parseInt(jobsToday?.emergency ?? "0", 10),
            yesterdayCount: parseInt(yesterdayJobs?.total ?? "0", 10),
          },
          openInvoices: {
            count: parseInt(openInvoices?.total ?? "0", 10),
            previousCount: parseInt(prevOpenInvoices?.total ?? "0", 10),
          },
          outstandingBalance: {
            amount: parseFloat(outstandingBalance?.amount ?? "0"),
            previousAmount: parseFloat(prevOutstanding?.amount ?? "0"),
          },
          thisMonthRevenue: {
            amount: parseFloat(thisMonthRevenue?.amount ?? "0"),
            previousAmount: parseFloat(prevRevenue?.amount ?? "0"),
          },
          activeCustomers: {
            count: parseInt(activeCustomers?.total ?? "0", 10),
          },
          upcomingBookings: {
            count: parseInt(upcomingBookings?.total ?? "0", 10),
          },
        },
        overdueInvoices: {
          count: parseInt(overdueInvoices?.total ?? "0", 10),
          totalAmount: parseFloat(overdueInvoices?.amount ?? "0"),
        },
        jobPipeline: jobPipelineResult.map((row) => ({
          stageName: row.stage_name,
          stageLabel: row.stage_label,
          stageColor: row.stage_color,
          count: parseInt(row.job_count, 10),
        })),
        revenueTrend: revenueTrendResult.map((row) => ({
          month: row.month,
          monthLabel: row.month_label,
          amount: parseFloat(row.amount),
        })),
        recentActivity: recentActivityResult.map((row) => ({
          id: row.id,
          type: row.type as "job" | "quote",
          action: row.action,
          description: row.description,
          entityId: row.entity_id,
          entityLabel: row.entity_label,
          createdAt: row.created_at,
        })),
        todaySchedule: todayScheduleResult.map((row) => ({
          id: row.id,
          jobNumber: row.job_number,
          customerName: row.customer_name,
          scheduledStart: row.scheduled_start,
          scheduledEnd: row.scheduled_end,
          status: row.status,
          priority: row.priority,
          serviceType: row.service_type,
        })),
        invoiceAging: invoiceAgingResult.map((row) => ({
          bucket: row.bucket as "current" | "30" | "60" | "90plus",
          count: parseInt(row.count, 10),
          amount: parseFloat(row.amount),
        })),
        quoteSummary: {
          totalQuotes,
          accepted,
          declined: parseInt(quoteSummaryRow?.declined ?? "0", 10),
          pending: parseInt(quoteSummaryRow?.pending ?? "0", 10),
          conversionRate: totalQuotes > 0 ? Math.round((accepted / totalQuotes) * 100) : 0,
        },
        weeklyJobVolume: weeklyJobVolumeResult.map((row) => ({
          day: row.day,
          value: parseInt(row.count, 10),
        })),
        weeklyRevenue: weeklyRevenueResult.map((row) => ({
          day: row.day,
          value: parseFloat(row.amount),
        })),
      },
    };
  });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
