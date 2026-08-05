"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageActions } from "@/components/dashboard/page-actions";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  IconBriefcase,
  IconCashBanknote,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import type {
  DashboardRevenueGranularity,
  DashboardStats,
} from "@hvac-saas/types";
import { useDashboardStats } from "@/hooks/queries";
import type { DashboardStatsParams } from "@/actions/dashboard";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { formatCurrency } from "@/lib/format";
import { DashboardSkeleton } from "@/components/dashboard/home/dashboard-skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";
import { OverdueAlertBanner } from "@/components/dashboard/home/overdue-alert-banner";
import { RecentActivityFeed } from "@/components/dashboard/home/recent-activity-feed";
import { KpiPill } from "@/components/dashboard/home/kpi-pill";
import { DashboardToolbar } from "@/components/dashboard/home/dashboard-toolbar";
import { RevenueRangeChart, type RevenueRange } from "@/components/dashboard/home/revenue-range-chart";
import { JobsManagementPanel } from "@/components/dashboard/home/jobs-management-panel";
import { RetentionChart } from "@/components/dashboard/home/retention-chart";
import { AgendaTimeline } from "@/components/dashboard/home/agenda-timeline";
import { WeekAhead } from "@/components/dashboard/home/week-ahead";
import { InvoiceAging } from "@/components/dashboard/home/invoice-aging";
import { QuoteConversion } from "@/components/dashboard/home/quote-conversion";
import { RevenueByServiceChart } from "@/components/dashboard/home/revenue-by-service-chart";
import { TopCustomersCard } from "@/components/dashboard/home/top-customers-card";
import { useDashboardWidgetPrefs } from "@/hooks/use-dashboard-widget-prefs";
import {
  DATE_RANGE_KEYS,
  useStoredDateRange,
} from "@/hooks/use-stored-date-range";

function rangeFromPreset(preset: RevenueRange): {
  range: DateRange;
  granularity: DashboardRevenueGranularity;
} {
  const today = new Date();
  switch (preset) {
    case "1D":
      return { range: { from: today, to: today }, granularity: "day" };
    case "1W":
      return { range: { from: subDays(today, 6), to: today }, granularity: "day" };
    case "1M":
      return { range: { from: subDays(today, 29), to: today }, granularity: "day" };
    case "6M":
      return { range: { from: subMonths(today, 6), to: today }, granularity: "week" };
    case "1Y":
      return { range: { from: subYears(today, 1), to: today }, granularity: "month" };
    case "ALL":
      return { range: { from: subYears(today, 3), to: today }, granularity: "month" };
  }
}

function inferPreset(range: DateRange | undefined): RevenueRange | null {
  if (!range?.from || !range?.to) return null;
  const span = differenceInCalendarDays(range.to, range.from);
  if (span === 0) return "1D";
  if (span === 6) return "1W";
  if (span === 29) return "1M";
  return null;
}

/** Pick a bucket size that yields a readable number of points for the span. */
function granularityForSpan(spanDays: number): DashboardRevenueGranularity {
  if (spanDays <= 31) return "day";
  if (spanDays <= 120) return "week";
  return "month";
}

interface DashboardPageClientProps {
  initialStats?: DashboardStats | null;
  initialError?: string | null;
  initialParams?: DashboardStatsParams;
  initialFetchedAt?: number;
}

export function DashboardPageClient({
  initialStats = null,
  initialError = null,
  initialParams,
  initialFetchedAt,
}: DashboardPageClientProps) {
  // No explicit range until the user picks one: the backend defaults to
  // month-to-date *in the tenant's timezone*, which the browser clock cannot
  // reliably reproduce. `stats.range` reports back what was actually used.
  const [dateParams, setDateParams] = useState<DashboardStatsParams>(
    initialParams ?? {},
  );
  const [revenueRange, setRevenueRange] = useState<RevenueRange | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const prefs = useDashboardWidgetPrefs();
  const { stored: storedRange, save: saveRange } = useStoredDateRange(
    DATE_RANGE_KEYS.dashboard,
  );

  // Restore the saved range once localStorage is readable. The stored dates are
  // replayed exactly — a shortcut like "Last 7 days" or the 1W tab is a way of
  // entering a range, not a standing instruction to re-derive one against
  // today, so nothing here recomputes.
  useEffect(() => {
    const stored = storedRange;
    if (!stored) return;
    setRevenueRange(stored.preset ?? null);
    setDateParams({
      from: stored.from,
      to: stored.to,
      granularity:
        stored.granularity ??
        granularityForSpan(
          differenceInCalendarDays(parseISO(stored.to), parseISO(stored.from)),
        ),
    });
  }, [storedRange]);

  const { data: result, isLoading, isFetching, dataUpdatedAt, refetch } =
    useDashboardStats(dateParams, {
      initialData: initialStats
        ? { data: initialStats, error: initialError }
        : undefined,
      initialParams,
      initialFetchedAt,
    });

  const stats = result?.data ?? null;

  // Show the user's own selection whenever there is one. Only when nothing has
  // been chosen does the control fall back to the backend-resolved range, which
  // is the tenant-timezone month-to-date default the browser cannot reproduce.
  //
  // Reading `stats.range` unconditionally used to make the control flicker back
  // to that default: a refetch empties `stats`, and the SSR payload always
  // carries the default range regardless of what was restored from storage. On
  // the 2nd of a month, month-to-date renders as "Aug 1 – Aug 2", so a saved
  // range appeared to reset itself on every visit.
  const dateRange = useMemo<DateRange | undefined>(() => {
    if (dateParams.from && dateParams.to) {
      return { from: parseISO(dateParams.from), to: parseISO(dateParams.to) };
    }
    if (!stats?.range) return undefined;
    return { from: parseISO(stats.range.from), to: parseISO(stats.range.to) };
  }, [dateParams.from, dateParams.to, stats?.range]);

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      // The picker no longer emits half-finished selections, so a missing end
      // means the range was genuinely cleared: fall back to the tenant-resolved
      // default and forget the saved one.
      if (!range?.from || !range?.to) {
        setDateParams({});
        setRevenueRange(null);
        saveRange(null);
        return;
      }
      const span = differenceInCalendarDays(range.to, range.from);
      const from = format(range.from, "yyyy-MM-dd");
      const to = format(range.to, "yyyy-MM-dd");
      const granularity = granularityForSpan(span);
      // Highlight a preset tab when the span happens to match one. This is
      // cosmetic: the dates below are what gets stored and replayed either way.
      // Storing the inferred preset *instead of* the dates is what used to make
      // a hand-picked range move — a 7-day selection was saved as "1W" and came
      // back as the seven days ending today, so any deliberate choice of an
      // earlier week silently jumped forward.
      const preset = inferPreset(range);
      setRevenueRange(preset);
      setDateParams({ from, to, granularity });
      saveRange({ from, to, granularity, preset });
    },
    [saveRange],
  );

  const handleRevenueRangeChange = useCallback(
    (preset: RevenueRange) => {
      const { range, granularity } = rangeFromPreset(preset);
      const from = format(range.from!, "yyyy-MM-dd");
      const to = format(range.to!, "yyyy-MM-dd");
      setRevenueRange(preset);
      setDateParams({ from, to, granularity });
      // Resolve the shortcut to real dates *now* and store those. The tab is an
      // input, not a subscription: clicking 1W on the 2nd means that week, not
      // "whatever the last week happens to be whenever I next open this page".
      saveRange({ from, to, granularity, preset });
    },
    [saveRange],
  );

  if (isLoading && !stats) {
    return (
      <section className="p-6">
        <DashboardSkeleton />
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="p-6">
        <LoadErrorState
          title="Couldn't load your dashboard"
          message={result?.error ?? initialError}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      </section>
    );
  }

  const { kpis } = stats;

  return (
    <section className="p-6">
      <div className="space-y-8">
        {/* Only the range picker goes to the navbar: it governs the whole page,
            so it belongs beside the page title. Per-object actions live next to
            the objects they create. */}
        <PageActions>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />
        </PageActions>

        <DashboardToolbar
          updatedAt={dataUpdatedAt}
          isFetching={isFetching}
          prefs={prefs}
        />

        {/* Widget visibility lives in localStorage, so hold the grid until it is
            read — otherwise all eleven widgets paint and hidden ones then vanish. */}
        {!prefs.hydrated ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-8">
            {prefs.visible.overdueAlert && (
              <WidgetErrorBoundary name="Overdue alert">
                <OverdueAlertBanner overdueInvoices={stats.overdueInvoices} />
              </WidgetErrorBoundary>
            )}

            {/* Row 1: KPI pills */}
            {prefs.visible.kpis && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <KpiPill
                  icon={IconBriefcase}
                  accent="brand"
                  label="Jobs Today"
                  value={String(kpis.jobsToday.count)}
                  currentValue={kpis.jobsToday.count}
                  previousValue={kpis.jobsToday.yesterdayCount}
                  comparisonLabel="vs yesterday"
                  href="/jobs"
                  footnote={
                    kpis.jobsToday.emergencyCount > 0
                      ? `${kpis.jobsToday.emergencyCount} emergency`
                      : undefined
                  }
                  footnoteTone="danger"
                />
                <KpiPill
                  icon={IconCashBanknote}
                  accent="emerald"
                  label="Outstanding"
                  value={formatCurrency(kpis.outstandingBalance.amount)}
                  windowLabel="All open"
                  href="/invoices"
                  footnote={`${kpis.outstandingBalance.invoiceCount} unpaid ${
                    kpis.outstandingBalance.invoiceCount === 1 ? "invoice" : "invoices"
                  }`}
                />
                <KpiPill
                  icon={IconTrendingUp}
                  accent="indigo"
                  label="Quote Conversion"
                  value={`${stats.quoteSummary.conversionRate}%`}
                  href="/quotes"
                  footnote={`${stats.quoteSummary.accepted} of ${stats.quoteSummary.totalQuotes} accepted`}
                />
                {/* `activeCustomers` was computed on every dashboard load and
                    displayed nowhere. It is the one KPI here that measures the
                    book of business rather than this week's work. */}
                <KpiPill
                  icon={IconUsers}
                  accent="teal"
                  label="Active Customers"
                  value={String(kpis.activeCustomers.count)}
                  windowLabel="Last 90 days"
                  href="/customers"
                  footnote="with a job booked"
                />
              </div>
            )}

            {/* Row 2: Revenue hero (full width) */}
            {prefs.visible.revenue && (
              <WidgetErrorBoundary name="Revenue">
                <RevenueRangeChart
                  data={stats.revenueTrend}
                  granularity={stats.revenueGranularity}
                  currentValue={kpis.rangeRevenue.amount}
                  previousValue={kpis.rangeRevenue.previousAmount}
                  billedValue={kpis.rangeRevenue.billedAmount}
                  range={revenueRange}
                  onRangeChange={handleRevenueRangeChange}
                />
              </WidgetErrorBoundary>
            )}

            {/*
              ONE flowing grid for every mid-size widget, instead of four fixed
              two-up rows.

              The rows were the reason holes kept appearing. Each was its own
              grid with two conditionally-rendered children, so hiding a single
              widget in Customize left half a row empty — with Quote Funnel off,
              Invoice Aging sat alone beside 50% of nothing. And because a grid
              row is as tall as its tallest child, the Agenda's long list
              stretched whatever happened to sit next to it, leaving a void
              under a short neighbour.

              Flowing them through one grid means hiding a widget simply reflows
              the rest, and `auto-rows-[24rem]` fixes every row to the same
              height so no card can drag another. Each widget already fills its
              cell with `h-full` and manages its own overflow.
            */}
            <div className="grid grid-cols-1 gap-6 lg:auto-rows-[24rem] lg:grid-cols-2 xl:grid-cols-3">
              {prefs.visible.jobsManagement && (
                <WidgetErrorBoundary name="Jobs management">
                  <JobsManagementPanel
                    defaultPipeline={stats.jobPipeline}
                    priorityBreakdown={stats.priorityBreakdown}
                    serviceBreakdown={stats.serviceBreakdown}
                    pipelineId={pipelineId}
                    onPipelineChange={setPipelineId}
                  />
                </WidgetErrorBoundary>
              )}
              {prefs.visible.invoiceAging && (
                <WidgetErrorBoundary name="Invoice aging">
                  <InvoiceAging data={stats.invoiceAging} />
                </WidgetErrorBoundary>
              )}
              {prefs.visible.agenda && (
                <WidgetErrorBoundary name="Agenda">
                  <AgendaTimeline agenda={stats.agenda} />
                </WidgetErrorBoundary>
              )}
              {prefs.visible.quoteFunnel && (
                <WidgetErrorBoundary name="Quote funnel">
                  <QuoteConversion data={stats.quoteSummary} />
                </WidgetErrorBoundary>
              )}
              {prefs.visible.retention && (
                <WidgetErrorBoundary name="Retention">
                  <RetentionChart data={stats.retentionTrend} />
                </WidgetErrorBoundary>
              )}
              {prefs.visible.revenueByService && (
                <WidgetErrorBoundary name="Revenue by service">
                  <RevenueByServiceChart data={stats.serviceRevenue} />
                </WidgetErrorBoundary>
              )}
            </div>

            {/* The week's shape, directly under the widgets that describe the
                work. Full width on purpose: seven columns on a shared baseline
                need horizontal room, and it answers the question the Agenda
                above it raises — "which day is that pile actually on". */}
            {prefs.visible.weekAhead && (
              <WidgetErrorBoundary name="Week ahead">
                <WeekAhead agenda={stats.agenda} />
              </WidgetErrorBoundary>
            )}

            {/* Top Customers and Activity are both ranked lists of short rows.
                Full width gave each one a single column of text across 1800px
                and stacked them into ~700px of scroll; side by side they read
                as the pair they are. */}
            {(prefs.visible.topCustomers || prefs.visible.activity) && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {prefs.visible.topCustomers && (
                  <WidgetErrorBoundary name="Top customers">
                    <TopCustomersCard data={stats.topCustomers} />
                  </WidgetErrorBoundary>
                )}
                {prefs.visible.activity && (
                  <WidgetErrorBoundary name="Activity feed">
                    <RecentActivityFeed activities={stats.recentActivity} />
                  </WidgetErrorBoundary>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
