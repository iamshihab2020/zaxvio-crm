"use client";

import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfMonth, subDays, subMonths, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  IconBriefcase,
  IconTrendingUp,
  IconUserDollar,
} from "@tabler/icons-react";
import type {
  DashboardRevenueGranularity,
  DashboardStats,
} from "@hvac-saas/types";
import { useDashboardStats } from "@/hooks/queries";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/reusable/page-header";
import { formatCurrency } from "@/lib/format";
import { DashboardSkeleton } from "@/components/dashboard/home/dashboard-skeleton";
import { OverdueAlertBanner } from "@/components/dashboard/home/overdue-alert-banner";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/home/recent-activity-feed";
import { KpiPill } from "@/components/dashboard/home/kpi-pill";
import { DashboardToolbar } from "@/components/dashboard/home/dashboard-toolbar";
import { RevenueRangeChart, type RevenueRange } from "@/components/dashboard/home/revenue-range-chart";
import { JobsManagementPanel } from "@/components/dashboard/home/jobs-management-panel";
import { RetentionChart } from "@/components/dashboard/home/retention-chart";
import { AgendaTimeline } from "@/components/dashboard/home/agenda-timeline";
import { useDashboardWidgetPrefs } from "@/hooks/use-dashboard-widget-prefs";

function toDateParams(
  range: DateRange | undefined,
  granularity: DashboardRevenueGranularity,
  pipelineId: string | null,
) {
  if (!range?.from || !range?.to) return undefined;
  return {
    from: format(range.from, "yyyy-MM-dd"),
    to: format(range.to, "yyyy-MM-dd"),
    granularity,
    ...(pipelineId ? { pipelineId } : {}),
  };
}

function rangeFromPreset(preset: RevenueRange): { range: DateRange; granularity: DashboardRevenueGranularity } {
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

interface DashboardPageClientProps {
  initialStats?: DashboardStats | null;
}

export function DashboardPageClient({ initialStats = null }: DashboardPageClientProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<DashboardRevenueGranularity>("month");
  const [revenueRange, setRevenueRange] = useState<RevenueRange | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const prefs = useDashboardWidgetPrefs();
  const dateParams = toDateParams(dateRange, granularity, pipelineId);

  const { data: result, isLoading, dataUpdatedAt } = useDashboardStats(
    dateParams,
    initialStats ? { data: initialStats, error: null } : undefined,
  );

  const stats = result?.data ?? null;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    // Sync tab state with the picker — null when no preset matches, so no tab is highlighted.
    setRevenueRange(inferPreset(range));
    // Also pick a sensible granularity based on the selected span.
    if (range?.from && range?.to) {
      const span = differenceInCalendarDays(range.to, range.from);
      setGranularity(span <= 31 ? "day" : span <= 120 ? "week" : "month");
    }
  };

  const handleRevenueRangeChange = (r: RevenueRange) => {
    setRevenueRange(r);
    const { range, granularity: gr } = rangeFromPreset(r);
    setDateRange(range);
    setGranularity(gr);
  };

  // Agenda has its own fixed window (next 7 days from today), independent of
  // the revenue date range, so long ranges like 1Y/ALL don't bloat the list.
  const agendaFrom = format(new Date(), "yyyy-MM-dd");
  const agendaTo = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const avgCustomerValue = useMemo(() => {
    if (!stats) return 0;
    const active = stats.kpis.activeCustomers.count;
    return active > 0 ? stats.kpis.thisMonthRevenue.amount / active : 0;
  }, [stats]);

  const avgCustomerValuePrev = useMemo(() => {
    if (!stats) return 0;
    const active = stats.kpis.activeCustomers.count || 1;
    return stats.kpis.thisMonthRevenue.previousAmount / active;
  }, [stats]);

  if (isLoading && !stats) {
    return (
      <section className="p-6">
        <DashboardSkeleton />
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="flex h-[60vh] items-center justify-center p-6">
        <p className="text-muted-foreground font-body">
          Failed to load dashboard data. Please try refreshing the page.
        </p>
      </section>
    );
  }

  return (
    <section className="p-6">
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your business at a glance."
          action={
            <div className="flex items-center gap-2">
              <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
              <QuickActions />
            </div>
          }
        />

        <DashboardToolbar updatedAt={dataUpdatedAt} prefs={prefs} />

        {prefs.visible.overdueAlert && (
          <OverdueAlertBanner overdueInvoices={stats.overdueInvoices} />
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {prefs.visible.kpis && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiPill
                  icon={IconBriefcase}
                  accent="brand"
                  label="Jobs Today"
                  value={String(stats.kpis.jobsToday.count)}
                  currentValue={stats.kpis.jobsToday.count}
                  previousValue={stats.kpis.jobsToday.yesterdayCount}
                  comparisonLabel="vs yesterday"
                  sparklineData={stats.weeklyJobVolume}
                  href="/jobs"
                />
                <KpiPill
                  icon={IconTrendingUp}
                  accent="indigo"
                  label="Conversion Rate"
                  value={`${stats.quoteSummary.conversionRate}%`}
                />
                <KpiPill
                  icon={IconUserDollar}
                  accent="emerald"
                  label="Avg Customer Value"
                  value={formatCurrency(avgCustomerValue)}
                  currentValue={avgCustomerValue}
                  previousValue={avgCustomerValuePrev}
                  sparklineData={stats.weeklyRevenue}
                />
              </div>
            )}

            {prefs.visible.revenue && (
              <RevenueRangeChart
                data={stats.revenueTrend}
                granularity={stats.revenueGranularity}
                currentValue={stats.kpis.thisMonthRevenue.amount}
                previousValue={stats.kpis.thisMonthRevenue.previousAmount}
                range={revenueRange}
                onRangeChange={handleRevenueRangeChange}
              />
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {prefs.visible.jobsManagement && (
                <JobsManagementPanel
                  pipeline={stats.jobPipeline}
                  priorityBreakdown={stats.priorityBreakdown}
                  serviceBreakdown={stats.serviceBreakdown}
                  pipelineId={pipelineId}
                  onPipelineChange={setPipelineId}
                />
              )}
              {prefs.visible.retention && (
                <RetentionChart data={stats.retentionTrend} />
              )}
            </div>

            {prefs.visible.activity && (
              <RecentActivityFeed activities={stats.recentActivity} />
            )}
          </div>

          {prefs.visible.agenda && (
            // Natural height — the card sizes to its content so it doesn't
            // leave empty space on short lists. No sticky positioning (that
            // caused column jumps when the pipeline Select opened).
            <div>
              <AgendaTimeline from={agendaFrom} to={agendaTo} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
