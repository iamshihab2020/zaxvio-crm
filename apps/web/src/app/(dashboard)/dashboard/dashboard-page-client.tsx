"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "@tabler/icons-react";
import type {
  DashboardRevenueGranularity,
  DashboardStats,
} from "@hvac-saas/types";
import { useDashboardStats } from "@/hooks/queries";
import type { DashboardStatsParams } from "@/actions/dashboard";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/reusable/page-header";
import { formatCurrency } from "@/lib/format";
import { DashboardSkeleton } from "@/components/dashboard/home/dashboard-skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";
import { OverdueAlertBanner } from "@/components/dashboard/home/overdue-alert-banner";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/home/recent-activity-feed";
import { KpiPill } from "@/components/dashboard/home/kpi-pill";
import { DashboardToolbar } from "@/components/dashboard/home/dashboard-toolbar";
import { RevenueRangeChart, type RevenueRange } from "@/components/dashboard/home/revenue-range-chart";
import { JobsManagementPanel } from "@/components/dashboard/home/jobs-management-panel";
import { RetentionChart } from "@/components/dashboard/home/retention-chart";
import { AgendaTimeline } from "@/components/dashboard/home/agenda-timeline";
import { InvoiceAging } from "@/components/dashboard/home/invoice-aging";
import { QuoteConversion } from "@/components/dashboard/home/quote-conversion";
import { RevenueByServiceChart } from "@/components/dashboard/home/revenue-by-service-chart";
import { TopCustomersCard } from "@/components/dashboard/home/top-customers-card";
import { useDashboardWidgetPrefs } from "@/hooks/use-dashboard-widget-prefs";

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

  const { data: result, isLoading, isFetching, dataUpdatedAt, refetch } =
    useDashboardStats(dateParams, {
      initialData: initialStats
        ? { data: initialStats, error: initialError }
        : undefined,
      initialParams,
      initialFetchedAt,
    });

  const stats = result?.data ?? null;

  // Reflect the backend-resolved range in the picker, so what is displayed is
  // always what was queried.
  const dateRange = useMemo<DateRange | undefined>(() => {
    if (!stats?.range) return undefined;
    return { from: parseISO(stats.range.from), to: parseISO(stats.range.to) };
  }, [stats?.range]);

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    if (!range?.from || !range?.to) {
      setDateParams({});
      setRevenueRange(null);
      return;
    }
    const span = differenceInCalendarDays(range.to, range.from);
    setDateParams({
      from: format(range.from, "yyyy-MM-dd"),
      to: format(range.to, "yyyy-MM-dd"),
      granularity: granularityForSpan(span),
    });
    // Highlight a preset tab only when the span matches one exactly.
    setRevenueRange(inferPreset(range));
  }, []);

  const handleRevenueRangeChange = useCallback((preset: RevenueRange) => {
    const { range, granularity } = rangeFromPreset(preset);
    setRevenueRange(preset);
    setDateParams({
      from: format(range.from!, "yyyy-MM-dd"),
      to: format(range.to!, "yyyy-MM-dd"),
      granularity,
    });
  }, []);

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
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your business at a glance."
          action={
            <div className="flex items-center gap-2">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
              />
              <QuickActions />
            </div>
          }
        />

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
          <div className="space-y-6">
            {prefs.visible.overdueAlert && (
              <WidgetErrorBoundary name="Overdue alert">
                <OverdueAlertBanner overdueInvoices={stats.overdueInvoices} />
              </WidgetErrorBoundary>
            )}

            {/* Row 1: KPI pills */}
            {prefs.visible.kpis && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiPill
                  icon={IconBriefcase}
                  accent="brand"
                  label="Jobs Today"
                  value={String(kpis.jobsToday.count)}
                  currentValue={kpis.jobsToday.count}
                  previousValue={kpis.jobsToday.yesterdayCount}
                  comparisonLabel="vs yesterday"
                  sparklineData={stats.weeklyJobVolume}
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
                  range={revenueRange}
                  onRangeChange={handleRevenueRangeChange}
                />
              </WidgetErrorBoundary>
            )}

            {/* Row 3: Jobs Management + Agenda side-by-side.
                A FIXED height, not a minimum. `min-h` let the Agenda grow to
                its full content height — thirteen entries ran it past 1000px —
                and dragged its neighbour along with it. The Agenda scrolls
                internally instead, and 24rem is set by the Jobs panel, whose
                content is a fixed 2x2 grid and cannot grow — about 308px, so
                22rem leaves it a normal bottom margin rather than a hole. */}
            <div className="grid grid-cols-1 gap-6 lg:h-[22rem] lg:grid-cols-2">
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
              {prefs.visible.agenda && (
                <WidgetErrorBoundary name="Agenda">
                  <AgendaTimeline agenda={stats.agenda} />
                </WidgetErrorBoundary>
              )}
            </div>

            {/* Row 4: Invoice Aging + Quote Funnel */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {prefs.visible.invoiceAging && (
                <WidgetErrorBoundary name="Invoice aging">
                  <InvoiceAging data={stats.invoiceAging} />
                </WidgetErrorBoundary>
              )}
              {prefs.visible.quoteFunnel && (
                <WidgetErrorBoundary name="Quote funnel">
                  <QuoteConversion data={stats.quoteSummary} />
                </WidgetErrorBoundary>
              )}
            </div>

            {/* Row 5: Retention + Revenue by Service */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

            {/* Row 6: Top Customers (full width) */}
            {prefs.visible.topCustomers && (
              <WidgetErrorBoundary name="Top customers">
                <TopCustomersCard data={stats.topCustomers} />
              </WidgetErrorBoundary>
            )}

            {/* Row 7: Activity Feed (full width) */}
            {prefs.visible.activity && (
              <WidgetErrorBoundary name="Activity feed">
                <RecentActivityFeed activities={stats.recentActivity} />
              </WidgetErrorBoundary>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
