import type { DbClient, DateRangeParams } from "./types.js";
import type {
  ReportSection,
  RevenueReportData,
  JobReportData,
  CustomerReportData,
  QuoteInvoiceReportData,
  BookingReportData,
} from "@hvac-saas/types";
import { pInt, pFloat, SERVICE_TYPE_LABELS, PAYMENT_METHOD_LABELS, PRIORITY_LABELS, QUOTE_STATUS_LABELS, INVOICE_STATUS_LABELS, AGING_LABELS, DAY_NAMES, JOB_STATUS_COLORS } from "./helpers.js";
import { analyticsCache, CACHE_TTL } from "./cache.js";
import * as revenueQ from "./queries/revenue.js";
import * as jobsQ from "./queries/jobs.js";
import * as customersQ from "./queries/customers.js";
import * as quotesInvoicesQ from "./queries/quotes-invoices.js";
import * as bookingsQ from "./queries/bookings.js";

/** Dispatch to the correct report section (cached). */
export async function getReportBySection(
  db: DbClient,
  section: ReportSection,
  params: DateRangeParams,
) {
  const cacheParams = { section, from: params.rangeFrom, to: params.rangeTo };

  return analyticsCache.getOrFetch(
    params.tenantId,
    `report:${section}`,
    cacheParams,
    async () => {
      switch (section) {
        case "revenue":
          return getRevenueReport(db, params);
        case "jobs":
          return getJobReport(db, params);
        case "customers":
          return getCustomerReport(db, params);
        case "quotes-invoices":
          return getQuoteInvoiceReport(db, params);
        case "bookings":
          return getBookingReport(db, params);
        default:
          return null;
      }
    },
    { ttlMs: CACHE_TTL.REPORTS, staleWhileRevalidate: true },
  );
}

// ── Revenue ──

async function getRevenueReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<RevenueReportData> {
  const { tenantId, rangeFrom, rangeTo, prevFrom, prevTo } = params;

  const [trendCurrent, trendPrevious, byServiceType, byPaymentMethod, avgJobValue, collectionResult, topCustomers, prevRevenueResult] =
    await Promise.all([
      revenueQ.getRevenueTrendByMonth(db, tenantId, rangeFrom, rangeTo),
      revenueQ.getRevenueTrendByMonth(db, tenantId, prevFrom, prevTo),
      revenueQ.getRevenueByServiceType(db, params),
      revenueQ.getRevenueByPaymentMethod(db, params),
      revenueQ.getAvgJobValueTrend(db, params),
      revenueQ.getCollectionRate(db, params),
      revenueQ.getTopCustomersByRevenue(db, params),
      revenueQ.getRevenueTotal(db, tenantId, prevFrom, prevTo),
    ]);

  const revenueTrend = trendCurrent.map((row, i) => ({
    month: row.month,
    monthLabel: row.month_label,
    current: pFloat(row.amount),
    previous: pFloat(trendPrevious[i]?.amount),
  }));

  const totalInvoiced = pFloat(collectionResult[0]?.invoiced);
  const totalCollected = pFloat(collectionResult[0]?.collected);
  const currentRevenue = trendCurrent.reduce((sum, r) => sum + pFloat(r.amount), 0);
  const avgValues = avgJobValue.filter((r) => pFloat(r.avg_value) > 0);

  return {
    revenueTrend,
    revenueByServiceType: byServiceType.map((r) => ({
      serviceType: r.service_type,
      label: SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
      amount: pFloat(r.amount),
    })),
    revenueByPaymentMethod: byPaymentMethod.map((r) => ({
      method: r.method,
      label: PAYMENT_METHOD_LABELS[r.method] ?? r.method,
      amount: pFloat(r.amount),
    })),
    avgJobValueTrend: avgJobValue.map((r) => ({
      month: r.month,
      monthLabel: r.month_label,
      avgValue: Math.round(pFloat(r.avg_value) * 100) / 100,
    })),
    collectionRate: {
      totalInvoiced,
      totalCollected,
      rate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0,
    },
    topCustomersByRevenue: topCustomers.map((r) => ({
      id: r.id,
      name: r.name,
      revenue: pFloat(r.revenue),
      jobCount: pInt(r.job_count),
    })),
    kpis: {
      totalRevenue: currentRevenue,
      previousRevenue: pFloat(prevRevenueResult[0]?.amount),
      avgJobValue:
        avgValues.length > 0
          ? Math.round(
              (avgValues.reduce((s, r) => s + pFloat(r.avg_value), 0) / avgValues.length) * 100,
            ) / 100
          : 0,
      previousAvgJobValue: 0,
    },
  };
}

// ── Jobs ──

async function getJobReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<JobReportData> {
  const { tenantId, rangeFrom, rangeTo, prevFrom, prevTo } = params;

  const [volumeTrend, byStatus, byPriority, byServiceType, avgCompletion, pipeline, kpisResult, prevKpis] =
    await Promise.all([
      jobsQ.getJobVolumeTrend(db, params),
      jobsQ.getJobsByStatus(db, params),
      jobsQ.getJobsByPriority(db, params),
      jobsQ.getJobsByServiceType(db, params),
      jobsQ.getAvgCompletionDays(db, params),
      jobsQ.getJobPipelineDistribution(db, tenantId, rangeFrom, rangeTo),
      jobsQ.getJobKpis(db, params),
      jobsQ.getJobCount(db, tenantId, prevFrom, prevTo),
    ]);

  const totalJobs = pInt(kpisResult[0]?.total);
  const completedJobs = pInt(kpisResult[0]?.completed);

  return {
    jobVolumeTrend: volumeTrend.map((r) => ({
      month: r.month,
      monthLabel: r.month_label,
      count: pInt(r.count),
    })),
    jobsByStatus: byStatus.map((r) => ({
      status: r.status,
      label: r.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count: pInt(r.count),
      color: JOB_STATUS_COLORS[r.status] ?? "#6b7280",
    })),
    jobsByPriority: byPriority.map((r) => ({
      priority: r.priority,
      label: PRIORITY_LABELS[r.priority] ?? r.priority,
      count: pInt(r.count),
    })),
    jobsByServiceType: byServiceType.map((r) => ({
      serviceType: r.service_type,
      label: SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
      count: pInt(r.count),
    })),
    avgCompletionDays: Math.round(pFloat(avgCompletion[0]?.avg_days) * 10) / 10,
    pipelineDistribution: pipeline.map((r) => ({
      stageLabel: r.stage_label,
      stageColor: r.stage_color,
      count: pInt(r.count),
    })),
    kpis: {
      totalJobs,
      previousJobs: pInt(prevKpis[0]?.total),
      completedJobs,
      cancelledJobs: pInt(kpisResult[0]?.cancelled),
      completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
    },
  };
}

// ── Customers ──

async function getCustomerReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<CustomerReportData> {
  const { tenantId, rangeFrom, rangeTo, prevFrom, prevTo } = params;

  const [newTrend, activeResult, topByJobs, repeatResult, newCurrent, newPrevious, totalResult] =
    await Promise.all([
      customersQ.getNewCustomersTrend(db, params),
      customersQ.getActiveVsInactiveCustomers(db, tenantId),
      customersQ.getTopCustomersByJobCount(db, tenantId),
      customersQ.getRepeatVsOneTime(db, tenantId),
      customersQ.getCustomerCount(db, tenantId, rangeFrom, rangeTo),
      customersQ.getCustomerCount(db, tenantId, prevFrom, prevTo),
      customersQ.getTotalCustomerCount(db, tenantId),
    ]);

  const currentNew = pInt(newCurrent[0]?.total);
  const previousNew = pInt(newPrevious[0]?.total);

  return {
    newCustomersTrend: newTrend.map((r) => ({
      month: r.month,
      monthLabel: r.month_label,
      count: pInt(r.count),
    })),
    growthRate: {
      current: currentNew,
      previous: previousNew,
      rate: previousNew > 0 ? Math.round(((currentNew - previousNew) / previousNew) * 100) : currentNew > 0 ? 100 : 0,
    },
    activeVsInactive: {
      active: pInt(activeResult[0]?.active),
      inactive: pInt(activeResult[0]?.inactive),
    },
    topCustomersByJobCount: topByJobs.map((r) => ({
      id: r.id,
      name: r.name,
      jobCount: pInt(r.job_count),
      totalSpent: pFloat(r.total_spent),
    })),
    repeatVsOneTime: {
      repeat: pInt(repeatResult[0]?.repeat_count),
      oneTime: pInt(repeatResult[0]?.onetime_count),
    },
    kpis: {
      totalCustomers: pInt(totalResult[0]?.total),
      newInPeriod: currentNew,
      previousNewInPeriod: previousNew,
    },
  };
}

// ── Quotes & Invoices ──

async function getQuoteInvoiceReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<QuoteInvoiceReportData> {
  const { tenantId, rangeFrom, rangeTo, prevFrom, prevTo } = params;

  const [quoteFunnel, invoiceStatus, invoiceAging, avgDays, overdueTrend, quoteKpisCurrent, quoteKpisPrev, invoiceKpis] =
    await Promise.all([
      quotesInvoicesQ.getQuoteConversionFunnel(db, params),
      quotesInvoicesQ.getInvoiceStatusDistribution(db, params),
      quotesInvoicesQ.getInvoiceAgingBuckets(db, tenantId),
      quotesInvoicesQ.getAvgDaysToPayment(db, params),
      quotesInvoicesQ.getOverdueInvoiceTrend(db, params),
      quotesInvoicesQ.getQuoteKpis(db, tenantId, rangeFrom, rangeTo),
      quotesInvoicesQ.getQuoteKpisPrev(db, tenantId, prevFrom, prevTo),
      quotesInvoicesQ.getInvoiceKpis(db, params),
    ]);

  const totalQuotes = pInt(quoteKpisCurrent[0]?.total);
  const acceptedQuotes = pInt(quoteKpisCurrent[0]?.accepted);
  const prevTotalQuotes = pInt(quoteKpisPrev[0]?.total);
  const prevAccepted = pInt(quoteKpisPrev[0]?.accepted);
  const totalInvoiced = pFloat(invoiceKpis[0]?.invoiced);
  const totalCollected = pFloat(invoiceKpis[0]?.collected);

  return {
    quoteConversionFunnel: quoteFunnel.map((r) => ({
      status: r.status,
      label: QUOTE_STATUS_LABELS[r.status] ?? r.status,
      count: pInt(r.count),
      value: pFloat(r.value),
    })),
    invoiceStatusDistribution: invoiceStatus.map((r) => ({
      status: r.status,
      label: INVOICE_STATUS_LABELS[r.status] ?? r.status,
      count: pInt(r.count),
    })),
    invoiceAgingDetail: invoiceAging.map((r) => ({
      bucket: r.bucket,
      label: AGING_LABELS[r.bucket] ?? r.bucket,
      count: pInt(r.count),
      amount: pFloat(r.amount),
    })),
    avgDaysToPayment: Math.round(pFloat(avgDays[0]?.avg_days)),
    overdueInvoiceTrend: overdueTrend.map((r) => ({
      month: r.month,
      monthLabel: r.month_label,
      count: pInt(r.count),
    })),
    quoteKpis: {
      totalQuotes,
      previousQuotes: prevTotalQuotes,
      totalValue: pFloat(quoteKpisCurrent[0]?.total_value),
      conversionRate: totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0,
      previousConversionRate: prevTotalQuotes > 0 ? Math.round((prevAccepted / prevTotalQuotes) * 100) : 0,
    },
    invoiceKpis: {
      totalInvoiced,
      totalCollected,
      collectionRate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0,
      previousCollectionRate: 0,
    },
  };
}

// ── Bookings ──

async function getBookingReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<BookingReportData> {
  const { tenantId, prevFrom, prevTo } = params;

  const [volumeTrend, byServiceType, conversionResult, byDay, kpisResult, prevKpis] =
    await Promise.all([
      bookingsQ.getBookingVolumeTrend(db, params),
      bookingsQ.getBookingsByServiceType(db, params),
      bookingsQ.getBookingConversionRate(db, params),
      bookingsQ.getBookingsByDayOfWeek(db, params),
      bookingsQ.getBookingKpis(db, params),
      bookingsQ.getBookingCount(db, tenantId, prevFrom, prevTo),
    ]);

  const totalBookings = pInt(conversionResult[0]?.total);
  const converted = pInt(conversionResult[0]?.converted);

  return {
    bookingVolumeTrend: volumeTrend.map((r) => ({
      month: r.month,
      monthLabel: r.month_label,
      count: pInt(r.count),
    })),
    bookingsByServiceType: byServiceType.map((r) => ({
      serviceType: r.service_type,
      label: SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
      count: pInt(r.count),
    })),
    bookingConversionRate: {
      totalBookings,
      converted,
      rate: totalBookings > 0 ? Math.round((converted / totalBookings) * 100) : 0,
    },
    bookingsByDayOfWeek: byDay.map((r) => ({
      day: DAY_NAMES[pInt(r.day_index)] ?? "Unknown",
      dayIndex: pInt(r.day_index),
      count: pInt(r.count),
    })),
    kpis: {
      totalBookings: pInt(kpisResult[0]?.total),
      previousBookings: pInt(prevKpis[0]?.total),
      pendingBookings: pInt(kpisResult[0]?.pending),
      conversionRate: totalBookings > 0 ? Math.round((converted / totalBookings) * 100) : 0,
    },
  };
}
