"use client";

import { useCallback, useEffect, useState } from "react";
import { format, startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import type { DashboardStats } from "@hvac-saas/types";
import { getDashboardStats } from "@/actions/dashboard";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/reusable/page-header";
import { DashboardSkeleton } from "@/components/dashboard/home/dashboard-skeleton";
import { KpiGrid } from "@/components/dashboard/home/kpi-grid";
import { OverdueAlertBanner } from "@/components/dashboard/home/overdue-alert-banner";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { RevenueChart } from "@/components/dashboard/home/revenue-chart";
import { JobPipelineChart } from "@/components/dashboard/home/job-pipeline-chart";
import { RecentActivityFeed } from "@/components/dashboard/home/recent-activity-feed";
import { TodaySchedule } from "@/components/dashboard/home/today-schedule";
import { InvoiceAging } from "@/components/dashboard/home/invoice-aging";
import { QuoteConversion } from "@/components/dashboard/home/quote-conversion";

function getTodayString(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getRevenueTitle(dateRange: DateRange | undefined): string {
  if (!dateRange?.from || !dateRange?.to) return "Revenue";
  return `Revenue — ${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`;
}

interface DashboardPageClientProps {
  initialStats?: DashboardStats | null;
}

export function DashboardPageClient({ initialStats = null }: DashboardPageClientProps) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [loading, setLoading] = useState(!initialStats);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const fetchStats = useCallback(async (range: DateRange | undefined) => {
    setLoading(true);
    const params = range?.from && range?.to
      ? { from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") }
      : undefined;

    const { data, error } = await getDashboardStats(params);
    if (error) {
      toast.error(error);
    }
    setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialStats) return;
    fetchStats(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      fetchStats(range);
    }
  };

  if (loading) {
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
        {/* Toolbar */}
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

        {/* Overdue Alert */}
        <OverdueAlertBanner overdueInvoices={stats.overdueInvoices} />

        {/* KPI Cards */}
        <KpiGrid
          kpis={stats.kpis}
          weeklyJobVolume={stats.weeklyJobVolume}
          weeklyRevenue={stats.weeklyRevenue}
        />

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <RevenueChart
              data={stats.revenueTrend}
              currentMonthRevenue={stats.kpis.thisMonthRevenue.amount}
              previousMonthRevenue={stats.kpis.thisMonthRevenue.previousAmount}
              title={getRevenueTitle(dateRange)}
            />
          </div>
          <div className="lg:col-span-2">
            <JobPipelineChart data={stats.jobPipeline} />
          </div>
        </div>

        {/* Widgets Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <TodaySchedule
            jobs={stats.todaySchedule}
            activeCustomers={stats.kpis.activeCustomers.count}
            upcomingBookings={stats.kpis.upcomingBookings.count}
          />
          <InvoiceAging data={stats.invoiceAging} />
          <QuoteConversion data={stats.quoteSummary} />
        </div>

        {/* Activity Feed */}
        <RecentActivityFeed activities={stats.recentActivity} />
      </div>
    </section>
  );
}
