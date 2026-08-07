import type { DbClient, DateRangeParams } from "./types.js";
import type {
  ReportSection,
  ReportSectionResponse,
  RevenueReportData,
  JobReportData,
  CustomerReportData,
  QuoteInvoiceReportData,
  BookingReportData,
} from "@hvac-saas/types";
import { getProfitabilityReport } from "../costing/profitability.service.js";
import { pInt, pFloat, SERVICE_TYPE_LABELS, PAYMENT_METHOD_LABELS, PRIORITY_LABELS, QUOTE_STATUS_LABELS, INVOICE_STATUS_LABELS, AGING_LABELS, DAY_NAMES, JOB_STATUS_COLORS } from "./helpers.js";
import { analyticsCache, CACHE_TTL } from "./cache.js";
import * as revenueQ from "./queries/revenue.js";
import * as jobsQ from "./queries/jobs.js";
import * as customersQ from "./queries/customers.js";
import * as quotesInvoicesQ from "./queries/quotes-invoices.js";
import * as bookingsQ from "./queries/bookings.js";

/** Minimal logger shape — accepts a Fastify logger without importing Fastify here. */
interface ServiceLogger {
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

/**
 * Dispatch to the correct report section (cached), wrapped in the envelope that
 * tells the client which section it is looking at and which windows produced it.
 */
export async function getReportBySection(
  db: DbClient,
  section: ReportSection,
  params: DateRangeParams,
  logger?: ServiceLogger,
): Promise<ReportSectionResponse> {
  // `tz` and `granularity` are part of the key because results genuinely vary by
  // both: every "today" boundary resolves in the tenant's timezone, and the
  // granularity decides the bucket size. Without them a tenant who changed their
  // timezone in Settings kept being served the old split for a full 10 minutes.
  const cacheParams = {
    section,
    from: params.rangeFrom,
    to: params.rangeTo,
    tz: params.timezone,
    granularity: params.granularity,
  };

  return analyticsCache.getOrFetch<ReportSectionResponse>(
    params.tenantId,
    `report:${section}`,
    cacheParams,
    () => buildSectionResponse(db, section, params),
    {
      ttlMs: CACHE_TTL.REPORTS,
      staleWhileRevalidate: true,
      onError: (error) =>
        logger?.error(
          { err: error, tenantId: params.tenantId, section },
          "report background revalidation failed; serving stale data",
        ),
    },
  );
}

/**
 * Exhaustive over `ReportSection`. Each branch builds its own union member, so
 * the section discriminant and the payload type are matched by the compiler
 * rather than by a cast. Adding a section to the enum without handling it here
 * is a compile error — previously it fell through to `return null`, which the
 * route turned into an HTTP 200 carrying an error string that the client then
 * rendered as an empty report.
 */
async function buildSectionResponse(
  db: DbClient,
  section: ReportSection,
  params: DateRangeParams,
): Promise<ReportSectionResponse> {
  const meta = {
    range: { from: params.rangeFrom, to: params.rangeTo },
    compareRange: { from: params.compareFrom, to: params.compareTo },
    granularity: params.granularity,
  };

  switch (section) {
    case "revenue":
      return { ...meta, section, data: await getRevenueReport(db, params) };
    case "jobs":
      return { ...meta, section, data: await getJobReport(db, params) };
    case "customers":
      return { ...meta, section, data: await getCustomerReport(db, params) };
    case "quotes-invoices":
      return { ...meta, section, data: await getQuoteInvoiceReport(db, params) };
    case "bookings":
      return { ...meta, section, data: await getBookingReport(db, params) };
    case "profitability":
      // No trend and no comparison series, so this is the one section that
      // ignores `granularity` and `compareRange`. They stay in the envelope
      // because the envelope describes what the server resolved, not what each
      // section happened to consume.
      return {
        ...meta,
        section,
        data: await getProfitabilityReport(
          db,
          params.tenantId,
          params.timezone,
          params.rangeFrom,
          params.rangeTo,
        ),
      };
    default: {
      const exhaustive: never = section;
      throw new Error(`Unhandled report section: ${String(exhaustive)}`);
    }
  }
}

/** Mean of the non-empty buckets in an average-value trend. */
function meanOfNonZero(rows: { avg_value: string }[]): number {
  const values = rows.map((r) => pFloat(r.avg_value)).filter((v) => v > 0);
  if (values.length === 0) return 0;
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

// ── Revenue ──

async function getRevenueReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<RevenueReportData> {
  const { tenantId, rangeFrom, rangeTo, compareFrom, compareTo, granularity } = params;

  const [
    trendCurrent,
    trendPrevious,
    byServiceType,
    byPaymentMethod,
    avgJobValue,
    avgJobValuePrev,
    collectionResult,
    topCustomers,
    prevRevenueResult,
  ] = await Promise.all([
    revenueQ.getRevenueTrend(db, tenantId, rangeFrom, rangeTo, granularity),
    revenueQ.getRevenueTrend(db, tenantId, compareFrom, compareTo, granularity),
    revenueQ.getRevenueByServiceType(db, params),
    revenueQ.getRevenueByPaymentMethod(db, params),
    revenueQ.getAvgJobValueTrend(db, params),
    revenueQ.getAvgJobValueTrend(db, params, compareFrom, compareTo),
    revenueQ.getCollectionRate(db, params),
    revenueQ.getTopCustomersByRevenue(db, params),
    revenueQ.getRevenueTotal(db, tenantId, compareFrom, compareTo),
  ]);

  // Both series are generated over windows that differ by a whole number of
  // buckets, so bucket `i` of one is exactly one period before bucket `i` of the
  // other and index pairing is meaningful. Previously the comparison window was
  // sized in *days*, which could yield a different bucket count — selecting
  // "Last month" plotted March against January and dropped February entirely.
  // `?? null` still guards the pairing rather than letting a missing row read as
  // a real £0.
  const revenueTrend = trendCurrent.map((row, i) => {
    const prev = trendPrevious[i];
    return {
      month: row.month,
      monthLabel: row.month_label,
      current: pFloat(row.amount),
      previous: prev ? pFloat(prev.amount) : null,
      previousLabel: prev ? prev.month_label : null,
    };
  });

  const totalInvoiced = pFloat(collectionResult[0]?.invoiced);
  const totalCollected = pFloat(collectionResult[0]?.collected);
  const currentRevenue = trendCurrent.reduce((sum, r) => sum + pFloat(r.amount), 0);

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
      avgJobValue: meanOfNonZero(avgJobValue),
      // Was hardcoded to 0, which `computeTrend` would have rendered as a
      // permanent "+100%" for anyone who wired it up.
      previousAvgJobValue: meanOfNonZero(avgJobValuePrev),
    },
  };
}

// ── Jobs ──

async function getJobReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<JobReportData> {
  const { tenantId, rangeFrom, rangeTo, compareFrom, compareTo } = params;

  const [volumeTrend, byStatus, byPriority, byServiceType, avgCompletion, pipeline, kpisResult, prevKpis] =
    await Promise.all([
      jobsQ.getJobVolumeTrend(db, params),
      jobsQ.getJobsByStatus(db, params),
      jobsQ.getJobsByPriority(db, params),
      jobsQ.getJobsByServiceType(db, params),
      jobsQ.getAvgCompletionDays(db, params),
      jobsQ.getJobPipelineDistribution(db, tenantId, rangeFrom, rangeTo),
      jobsQ.getJobKpis(db, params),
      jobsQ.getJobCount(db, tenantId, compareFrom, compareTo),
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
  const { tenantId, timezone, rangeFrom, rangeTo, compareFrom, compareTo } = params;

  const [newTrend, activeResult, topByJobs, repeatResult, newCurrent, newPrevious, totalResult] =
    await Promise.all([
      customersQ.getNewCustomersTrend(db, params),
      customersQ.getActiveVsInactiveCustomers(db, tenantId, timezone),
      customersQ.getTopCustomersByJobCount(db, tenantId),
      customersQ.getRepeatVsOneTime(db, tenantId),
      customersQ.getCustomerCount(db, tenantId, rangeFrom, rangeTo, timezone),
      customersQ.getCustomerCount(db, tenantId, compareFrom, compareTo, timezone),
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
  const { tenantId, timezone, rangeFrom, rangeTo, compareFrom, compareTo } = params;

  const [
    quoteFunnel,
    invoiceStatus,
    invoiceAging,
    avgDays,
    overdueTrend,
    quoteKpisCurrent,
    quoteKpisPrev,
    invoiceKpis,
    invoiceKpisPrev,
  ] = await Promise.all([
    quotesInvoicesQ.getQuoteConversionFunnel(db, params),
    quotesInvoicesQ.getInvoiceStatusDistribution(db, params),
    quotesInvoicesQ.getInvoiceAgingBuckets(db, tenantId, timezone),
    quotesInvoicesQ.getAvgDaysToPayment(db, params),
    quotesInvoicesQ.getOverdueInvoiceTrend(db, params),
    quotesInvoicesQ.getQuoteKpis(db, tenantId, rangeFrom, rangeTo, timezone),
    quotesInvoicesQ.getQuoteKpisPrev(db, tenantId, compareFrom, compareTo, timezone),
    quotesInvoicesQ.getInvoiceKpis(db, params),
    quotesInvoicesQ.getInvoiceKpis(db, params, compareFrom, compareTo),
  ]);

  const totalQuotes = pInt(quoteKpisCurrent[0]?.total);
  const acceptedQuotes = pInt(quoteKpisCurrent[0]?.accepted);
  const prevTotalQuotes = pInt(quoteKpisPrev[0]?.total);
  const prevAccepted = pInt(quoteKpisPrev[0]?.accepted);
  const totalInvoiced = pFloat(invoiceKpis[0]?.invoiced);
  const totalCollected = pFloat(invoiceKpis[0]?.collected);
  const prevInvoiced = pFloat(invoiceKpisPrev[0]?.invoiced);
  const prevCollected = pFloat(invoiceKpisPrev[0]?.collected);

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
      // Was hardcoded to 0 while shipping in the typed contract as though computed.
      previousCollectionRate:
        prevInvoiced > 0 ? Math.round((prevCollected / prevInvoiced) * 100) : 0,
    },
  };
}

// ── Bookings ──

async function getBookingReport(
  db: DbClient,
  params: DateRangeParams,
): Promise<BookingReportData> {
  const { tenantId, compareFrom, compareTo } = params;

  const [volumeTrend, byServiceType, conversionResult, byDay, kpisResult, prevKpis] =
    await Promise.all([
      bookingsQ.getBookingVolumeTrend(db, params),
      bookingsQ.getBookingsByServiceType(db, params),
      bookingsQ.getBookingConversionRate(db, params),
      bookingsQ.getBookingsByDayOfWeek(db, params),
      bookingsQ.getBookingKpis(db, params),
      bookingsQ.getBookingCount(db, tenantId, compareFrom, compareTo),
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
