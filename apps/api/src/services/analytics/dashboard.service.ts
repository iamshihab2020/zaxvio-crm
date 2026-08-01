import type { DbClient, DateRangeParams } from "./types.js";
import type { DashboardStats, DashboardRevenueGranularity, DashboardPipelineItem } from "@hvac-saas/types";
import { pInt, pFloat } from "./helpers.js";
import { addDays, startOfMonthsAgo, titleCase, todayInTimezone } from "./types.js";
import { analyticsCache, CACHE_TTL } from "./cache.js";
import * as revenueQ from "./queries/revenue.js";
import * as jobsQ from "./queries/jobs.js";
import * as customersQ from "./queries/customers.js";
import * as quotesInvoicesQ from "./queries/quotes-invoices.js";
import * as dashboardQ from "./queries/dashboard-only.js";

/** Minimal logger shape — accepts a Fastify logger without importing Fastify here. */
interface ServiceLogger {
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

/** How far ahead the agenda looks, in days. */
const AGENDA_WINDOW_DAYS = 7;
/** How many months of history the retention trend covers. */
const RETENTION_MONTHS = 5;

export async function getDashboardStats(
  db: DbClient,
  params: DateRangeParams,
  granularity: DashboardRevenueGranularity = "month",
  logger?: ServiceLogger,
): Promise<DashboardStats> {
  const cacheParams = {
    from: params.rangeFrom,
    to: params.rangeTo,
    tz: params.timezone,
    granularity,
  };

  return analyticsCache.getOrFetch(
    params.tenantId,
    "dashboard",
    cacheParams,
    () => fetchDashboardStats(db, params, granularity),
    {
      ttlMs: CACHE_TTL.REALTIME,
      staleWhileRevalidate: true,
      onError: (error) =>
        logger?.error(
          { err: error, tenantId: params.tenantId },
          "dashboard stats background revalidation failed; serving stale data",
        ),
    },
  );
}

/**
 * Pipeline stage distribution on its own cache key, so the pipeline selector does
 * not force a refetch of the entire dashboard.
 */
export async function getDashboardPipelineBreakdown(
  db: DbClient,
  tenantId: string,
  pipelineId: string | null,
  logger?: ServiceLogger,
): Promise<DashboardPipelineItem[]> {
  return analyticsCache.getOrFetch(
    tenantId,
    "dashboard-pipeline",
    { pipelineId: pipelineId ?? "default" },
    async () => {
      const rows = await dashboardQ.getDashboardPipeline(db, tenantId, pipelineId);
      return rows.map(toPipelineItem);
    },
    {
      ttlMs: CACHE_TTL.REALTIME,
      staleWhileRevalidate: true,
      onError: (error) =>
        logger?.error(
          { err: error, tenantId },
          "dashboard pipeline background revalidation failed; serving stale data",
        ),
    },
  );
}

function toPipelineItem(row: {
  stage_name: string;
  stage_label: string;
  stage_color: string;
  job_count: string;
}): DashboardPipelineItem {
  return {
    stageName: row.stage_name,
    stageLabel: row.stage_label,
    stageColor: row.stage_color,
    count: pInt(row.job_count),
  };
}

async function fetchDashboardStats(
  db: DbClient,
  params: DateRangeParams,
  granularity: DashboardRevenueGranularity,
): Promise<DashboardStats> {
  const { tenantId, timezone, rangeFrom, rangeTo, prevFrom, prevTo } = params;

  // All "today" boundaries resolve in the tenant's timezone, not the server's.
  const today = todayInTimezone(timezone);
  const yesterday = addDays(today, -1);
  const agendaTo = addDays(today, AGENDA_WINDOW_DAYS);
  const retentionFrom = startOfMonthsAgo(today, RETENTION_MONTHS);

  const [
    jobsTodayResult,
    revenueResult,
    activeCustomersResult,
    overdueResult,
    pipelineResult,
    revenueTrendResult,
    activityResult,
    prevRevenueResult,
    yesterdayJobsResult,
    invoiceAgingResult,
    quoteSummaryResult,
    invoicedTrendResult,
    invoicedTotalResult,
    retentionResult,
    priorityBreakdownResult,
    serviceBreakdownResult,
    serviceRevenueResult,
    topCustomersResult,
    agendaEventsResult,
    agendaJobsResult,
    agendaBookingsResult,
  ] = await Promise.all([
    // 1. Jobs today (tenant-local)
    jobsQ.getJobsToday(db, tenantId, timezone),
    // 2. Revenue in range
    revenueQ.getRevenueTotal(db, tenantId, rangeFrom, rangeTo),
    // 3. Active customers (trailing 90 days, always current)
    customersQ.getActiveCustomerCount(db, tenantId, timezone),
    // 4. Overdue invoices (derived from due_date, not stored status)
    quotesInvoicesQ.getOverdueInvoiceSummary(db, tenantId, timezone),
    // 5. Job pipeline for the tenant's default pipeline
    dashboardQ.getDashboardPipeline(db, tenantId, null),
    // 6. Revenue trend — respects selected range + granularity
    revenueQ.getRevenueTrend(db, tenantId, rangeFrom, rangeTo, granularity),
    // 7. Recent activity
    dashboardQ.getRecentActivity(db, tenantId),
    // 8. Previous-period revenue
    revenueQ.getRevenueTotal(db, tenantId, prevFrom, prevTo),
    // 9. Yesterday's jobs
    jobsQ.getJobCount(db, tenantId, yesterday, yesterday),
    // 10. Invoice aging — also the source for the outstanding-balance KPI
    quotesInvoicesQ.getInvoiceAgingBuckets(db, tenantId, timezone),
    // 11. Quote summary
    quotesInvoicesQ.getQuoteSummary(db, tenantId, rangeFrom, rangeTo, timezone),
    // 12. Billed trend — same buckets as the revenue trend, so the two plot together
    revenueQ.getInvoicedTrend(db, tenantId, rangeFrom, rangeTo, granularity),
    // 13. Billed total for the range
    revenueQ.getInvoicedTotal(db, tenantId, rangeFrom, rangeTo),
    // 14. Repeat-customer retention trend (last 6 months, independent of range)
    customersQ.getRepeatCustomerRateByMonth(db, tenantId, retentionFrom, today),
    // 15. Priority breakdown for range
    jobsQ.getJobsByPriority(db, params),
    // 16. Service type breakdown for range
    jobsQ.getJobsByServiceType(db, params),
    // 17. Revenue composition by service type
    revenueQ.getRevenueByServiceType(db, params),
    // 18. Top customers by revenue in range
    revenueQ.getTopCustomersByRevenue(db, params),
    // 19-21. Agenda (next 7 days, independent of range)
    dashboardQ.getUpcomingEvents(db, tenantId, today, agendaTo),
    dashboardQ.getUpcomingJobs(db, tenantId, today, agendaTo),
    dashboardQ.getUpcomingBookings(db, tenantId, today, agendaTo),
  ]);

  const quoteSummaryRow = quoteSummaryResult[0];
  const totalQuotes = pInt(quoteSummaryRow?.total_quotes);
  const accepted = pInt(quoteSummaryRow?.accepted);

  const invoiceAging = invoiceAgingResult.map((row) => ({
    bucket: row.bucket as DashboardStats["invoiceAging"][number]["bucket"],
    count: pInt(row.count),
    amount: pFloat(row.amount),
  }));

  // Outstanding balance is every unpaid invoice, which is exactly what the aging
  // buckets already sum to — no extra query needed.
  const outstandingBalance = invoiceAging.reduce((sum, b) => sum + b.amount, 0);
  const openInvoiceCount = invoiceAging.reduce((sum, b) => sum + b.count, 0);

  /**
   * Merge billed onto collected **by bucket key**, never by array index.
   *
   * Both series come from the same `bucketSeries(granularity, from, to)`, so
   * today they are the same length in the same order — but zipping on index is
   * exactly the defect the /reports audit found (REP-02), where two
   * `generate_series` results were paired positionally and a month went
   * missing. A key lookup cannot drift.
   */
  const billedByBucket = new Map(
    invoicedTrendResult.map((row) => [row.month, pFloat(row.amount)]),
  );

  return {
    range: { from: rangeFrom, to: rangeTo },
    kpis: {
      jobsToday: {
        count: pInt(jobsTodayResult[0]?.total),
        emergencyCount: pInt(jobsTodayResult[0]?.emergency),
        yesterdayCount: pInt(yesterdayJobsResult[0]?.total),
      },
      outstandingBalance: {
        amount: outstandingBalance,
        invoiceCount: openInvoiceCount,
      },
      rangeRevenue: {
        amount: pFloat(revenueResult[0]?.amount),
        previousAmount: pFloat(prevRevenueResult[0]?.amount),
        billedAmount: pFloat(invoicedTotalResult[0]?.amount),
      },
      activeCustomers: {
        count: pInt(activeCustomersResult[0]?.total),
      },
    },
    overdueInvoices: {
      count: pInt(overdueResult[0]?.total),
      totalAmount: pFloat(overdueResult[0]?.amount),
    },
    jobPipeline: pipelineResult.map(toPipelineItem),
    revenueTrend: revenueTrendResult.map((row) => ({
      month: row.month,
      monthLabel: row.month_label,
      amount: pFloat(row.amount),
      billed: billedByBucket.get(row.month) ?? 0,
    })),
    recentActivity: activityResult.map((row) => ({
      id: row.id,
      type: row.type as "job" | "quote",
      action: row.action,
      description: row.description,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      createdAt: row.created_at,
    })),
    invoiceAging,
    quoteSummary: {
      totalQuotes,
      accepted,
      declined: pInt(quoteSummaryRow?.declined),
      pending: pInt(quoteSummaryRow?.pending),
      conversionRate: totalQuotes > 0 ? Math.round((accepted / totalQuotes) * 100) : 0,
    },
    retentionTrend: retentionResult.map((row) => {
      const total = pInt(row.total_count);
      const repeat = pInt(row.repeat_count);
      return {
        month: row.month,
        monthLabel: row.month_label,
        repeatCount: repeat,
        totalCount: total,
        repeatRate: total > 0 ? Math.round((repeat / total) * 100) : 0,
      };
    }),
    revenueGranularity: granularity,
    priorityBreakdown: priorityBreakdownResult.map((r) => ({
      key: r.priority,
      label: titleCase(r.priority),
      count: pInt(r.count),
    })),
    serviceBreakdown: serviceBreakdownResult.map((r) => ({
      key: r.service_type,
      label: titleCase(r.service_type),
      count: pInt(r.count),
    })),
    serviceRevenue: serviceRevenueResult.map((row) => ({
      serviceType: row.service_type ?? "other",
      label: titleCase(row.service_type),
      amount: pFloat(row.amount),
    })),
    topCustomers: topCustomersResult.map((row) => ({
      id: row.id,
      name: row.name ?? "Customer",
      revenue: pFloat(row.revenue),
      jobCount: pInt(row.job_count),
    })),
    agenda: {
      from: today,
      to: agendaTo,
      events: agendaEventsResult.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        eventDate: r.event_date,
        startTime: r.start_time,
        endTime: r.end_time,
        contactName: r.contact_name,
        address: r.address,
        color: r.color,
      })),
      jobs: agendaJobsResult.map((r) => ({
        id: r.id,
        jobNumber: r.job_number,
        title: r.title,
        customerName: r.customer_name,
        address: r.address,
        serviceType: r.service_type,
        priority: r.priority,
        scheduledDate: r.scheduled_date,
        scheduledStart: r.scheduled_start,
        scheduledEnd: r.scheduled_end,
      })),
      bookings: agendaBookingsResult.map((r) => ({
        id: r.id,
        customerName: r.customer_name,
        serviceType: r.service_type,
        bookingDate: r.booking_date,
        preferredTime: r.preferred_time,
        address: r.address,
        description: r.description,
      })),
    },
  };
}
