import type { DbClient, DateRangeParams } from "./types.js";
import type { DashboardStats, DashboardRevenueGranularity } from "@hvac-saas/types";
import { pInt, pFloat } from "./helpers.js";
import { analyticsCache, CACHE_TTL } from "./cache.js";
import * as revenueQ from "./queries/revenue.js";
import * as jobsQ from "./queries/jobs.js";
import * as customersQ from "./queries/customers.js";
import * as quotesInvoicesQ from "./queries/quotes-invoices.js";
import * as bookingsQ from "./queries/bookings.js";
import * as dashboardQ from "./queries/dashboard-only.js";

export async function getDashboardStats(
  db: DbClient,
  params: DateRangeParams,
  granularity: DashboardRevenueGranularity = "month",
  pipelineId: string | null = null,
): Promise<DashboardStats> {
  const cacheParams = {
    from: params.rangeFrom,
    to: params.rangeTo,
    granularity,
    pipelineId: pipelineId ?? "default",
  };

  return analyticsCache.getOrFetch(
    params.tenantId,
    "dashboard",
    cacheParams,
    () => fetchDashboardStats(db, params, granularity, pipelineId),
    { ttlMs: CACHE_TTL.REALTIME, staleWhileRevalidate: true },
  );
}

async function fetchDashboardStats(
  db: DbClient,
  params: DateRangeParams,
  granularity: DashboardRevenueGranularity,
  pipelineId: string | null,
): Promise<DashboardStats> {
  const { tenantId, rangeFrom, rangeTo, prevFrom, prevTo } = params;

  const [
    jobsTodayResult,
    openInvoicesResult,
    outstandingResult,
    revenueResult,
    activeCustomersResult,
    upcomingBookingsResult,
    overdueResult,
    pipelineResult,
    revenueTrendResult,
    activityResult,
    prevRevenueResult,
    prevOpenInvoicesResult,
    prevOutstandingResult,
    yesterdayJobsResult,
    todayScheduleResult,
    invoiceAgingResult,
    quoteSummaryResult,
    weeklyJobVolumeResult,
    weeklyRevenueResult,
    retentionResult,
    priorityBreakdownResult,
    serviceBreakdownResult,
  ] = await Promise.all([
    // 1. Jobs today
    jobsQ.getJobsToday(db, tenantId),
    // 2. Open invoices
    quotesInvoicesQ.getOpenInvoiceCount(db, tenantId, rangeFrom, rangeTo),
    // 3. Outstanding balance
    quotesInvoicesQ.getOutstandingBalance(db, tenantId, rangeFrom, rangeTo),
    // 4. Revenue in range
    revenueQ.getRevenueTotal(db, tenantId, rangeFrom, rangeTo),
    // 5. Active customers (always current)
    customersQ.getActiveCustomerCount(db, tenantId),
    // 6. Upcoming bookings
    bookingsQ.getPendingBookingCount(db, tenantId),
    // 7. Overdue invoices
    quotesInvoicesQ.getOverdueInvoiceSummary(db, tenantId),
    // 8. Job pipeline (respects selected pipeline or falls back to default)
    dashboardQ.getDashboardPipeline(db, tenantId, pipelineId),
    // 9. Revenue trend — respects selected range + granularity
    revenueQ.getRevenueTrend(db, tenantId, rangeFrom, rangeTo, granularity),
    // 10. Recent activity
    dashboardQ.getRecentActivity(db, tenantId),
    // 11. Previous revenue
    revenueQ.getRevenueTotal(db, tenantId, prevFrom, prevTo),
    // 12. Previous open invoices
    quotesInvoicesQ.getOpenInvoiceCount(db, tenantId, prevFrom, prevTo),
    // 13. Previous outstanding
    quotesInvoicesQ.getOutstandingBalance(db, tenantId, prevFrom, prevTo),
    // 14. Yesterday's jobs
    jobsQ.getJobCount(db, tenantId, formatYesterday(), formatYesterday()),
    // 15. Today's schedule
    dashboardQ.getTodaySchedule(db, tenantId),
    // 16. Invoice aging
    quotesInvoicesQ.getInvoiceAgingBuckets(db, tenantId),
    // 17. Quote summary
    quotesInvoicesQ.getQuoteSummary(db, tenantId, rangeFrom, rangeTo),
    // 18. Weekly job volume sparkline
    dashboardQ.getWeeklyJobVolume(db, tenantId),
    // 19. Weekly revenue sparkline
    dashboardQ.getWeeklyRevenue(db, tenantId),
    // 20. Repeat-customer retention trend (last 6 months, independent of range)
    customersQ.getRepeatCustomerRateByMonth(db, tenantId, formatPastMonths(5), formatToday()),
    // 21. Priority breakdown for range
    jobsQ.getJobsByPriority(db, params),
    // 22. Service type breakdown for range
    jobsQ.getJobsByServiceType(db, params),
  ]);

  const quoteSummaryRow = quoteSummaryResult[0];
  const totalQuotes = pInt(quoteSummaryRow?.total_quotes);
  const accepted = pInt(quoteSummaryRow?.accepted);

  return {
    kpis: {
      jobsToday: {
        count: pInt(jobsTodayResult[0]?.total),
        emergencyCount: pInt(jobsTodayResult[0]?.emergency),
        yesterdayCount: pInt(yesterdayJobsResult[0]?.total),
      },
      openInvoices: {
        count: pInt(openInvoicesResult[0]?.total),
        previousCount: pInt(prevOpenInvoicesResult[0]?.total),
      },
      outstandingBalance: {
        amount: pFloat(outstandingResult[0]?.amount),
        previousAmount: pFloat(prevOutstandingResult[0]?.amount),
      },
      thisMonthRevenue: {
        amount: pFloat(revenueResult[0]?.amount),
        previousAmount: pFloat(prevRevenueResult[0]?.amount),
      },
      activeCustomers: {
        count: pInt(activeCustomersResult[0]?.total),
      },
      upcomingBookings: {
        count: pInt(upcomingBookingsResult[0]?.total),
      },
    },
    overdueInvoices: {
      count: pInt(overdueResult[0]?.total),
      totalAmount: pFloat(overdueResult[0]?.amount),
    },
    jobPipeline: pipelineResult.map((row) => ({
      stageName: row.stage_name,
      stageLabel: row.stage_label,
      stageColor: row.stage_color,
      count: pInt(row.job_count),
    })),
    revenueTrend: revenueTrendResult.map((row) => ({
      month: row.month,
      monthLabel: row.month_label,
      amount: pFloat(row.amount),
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
      count: pInt(row.count),
      amount: pFloat(row.amount),
    })),
    quoteSummary: {
      totalQuotes,
      accepted,
      declined: pInt(quoteSummaryRow?.declined),
      pending: pInt(quoteSummaryRow?.pending),
      conversionRate: totalQuotes > 0 ? Math.round((accepted / totalQuotes) * 100) : 0,
    },
    weeklyJobVolume: weeklyJobVolumeResult.map((row) => ({
      day: row.day,
      value: pInt(row.count),
    })),
    weeklyRevenue: weeklyRevenueResult.map((row) => ({
      day: row.day,
      value: pFloat(row.amount),
    })),
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
    selectedPipelineId: pipelineId,
  };
}

function titleCase(input: string | null | undefined): string {
  if (!input) return "Other";
  return input.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Date helpers ──

function formatToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function formatPastMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(1); // start of month
  return d.toISOString().split("T")[0];
}
