"use client";

import {
  IconCalendarEvent,
  IconFileInvoice,
  IconCurrencyDollar,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { DashboardKpis, DashboardSparklinePoint } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";
import { KpiCard } from "./kpi-card";

interface KpiGridProps {
  kpis: DashboardKpis;
  weeklyJobVolume: DashboardSparklinePoint[];
  weeklyRevenue: DashboardSparklinePoint[];
}

export function KpiGrid({ kpis, weeklyJobVolume, weeklyRevenue }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        icon={IconCalendarEvent}
        label="Jobs Today"
        value={String(kpis.jobsToday.count)}
        currentValue={kpis.jobsToday.count}
        previousValue={kpis.jobsToday.yesterdayCount}
        sparklineData={weeklyJobVolume}
        href="/jobs"
        badge={
          kpis.jobsToday.emergencyCount > 0
            ? {
                text: `${kpis.jobsToday.emergencyCount} emergency`,
                variant: "destructive",
              }
            : undefined
        }
      />
      <KpiCard
        icon={IconTrendingUp}
        label="Revenue"
        value={formatCurrency(kpis.thisMonthRevenue.amount)}
        currentValue={kpis.thisMonthRevenue.amount}
        previousValue={kpis.thisMonthRevenue.previousAmount}
        sparklineData={weeklyRevenue}
      />
      <KpiCard
        icon={IconCurrencyDollar}
        label="Outstanding"
        value={formatCurrency(kpis.outstandingBalance.amount)}
        currentValue={kpis.outstandingBalance.amount}
        previousValue={kpis.outstandingBalance.previousAmount}
        trendInverted
        href="/invoices"
      />
      <KpiCard
        icon={IconFileInvoice}
        label="Open Invoices"
        value={String(kpis.openInvoices.count)}
        currentValue={kpis.openInvoices.count}
        previousValue={kpis.openInvoices.previousCount}
        trendInverted
        href="/invoices"
      />
    </div>
  );
}
