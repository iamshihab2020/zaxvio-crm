"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconUsers,
  IconUserPlus,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { CustomerReportData, ReportGranularity } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { chartAnimation } from "@/components/dashboard/home/chart-motion";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";

const newCustomersConfig = {
  count: { label: "New Customers", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const activeInactiveConfig = {
  active: { label: "Active", color: "hsl(var(--chart-1))" },
  inactive: { label: "Inactive", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

const repeatConfig = {
  repeat: { label: "Repeat", color: "hsl(var(--chart-3))" },
  oneTime: { label: "One-Time", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

// Stable for the two pies below: see CURRENCY_TOOLTIP in revenue-tab.tsx for why
// a pie's tooltip element must not be rebuilt on every render.
const PIE_TOOLTIP = <ChartTooltipContent />;

const formatCount = (n: number) => String(n);
const formatSignedPercent = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

interface CustomersTabProps {
  data: CustomerReportData;
  granularity: ReportGranularity;
  /** Section and range these figures belong to; the table re-lays rows on it. */
  viewKey: string;
}

export function CustomersTab({ data, granularity, viewKey }: CustomersTabProps) {
  // Memoised on purpose, now that the rings animate: Recharts restarts a
  // `Pie`'s draw-in when its `data` changes identity, so arrays rebuilt on every
  // render would replay both rings whenever the page re-rendered (a refetch
  // toggling `isFetching`, say). `data` only changes when the report does.
  const activeInactiveData = useMemo(
    () => [
      { name: "Active", value: data.activeVsInactive.active, key: "active" },
      { name: "Inactive", value: data.activeVsInactive.inactive, key: "inactive" },
    ],
    [data.activeVsInactive],
  );

  const repeatData = useMemo(
    () => [
      { name: "Repeat", value: data.repeatVsOneTime.repeat, key: "repeat" },
      { name: "One-Time", value: data.repeatVsOneTime.oneTime, key: "oneTime" },
    ],
    [data.repeatVsOneTime],
  );

  const anim = chartAnimation();

  return (
    <div data-stagger className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Customers",
            value: String(data.kpis.totalCustomers),
            numericValue: data.kpis.totalCustomers,
            format: formatCount,
            icon: IconUsers,
          },
          {
            label: "New This Period",
            value: String(data.kpis.newInPeriod),
            numericValue: data.kpis.newInPeriod,
            format: formatCount,
            icon: IconUserPlus,
            currentValue: data.kpis.newInPeriod,
            previousValue: data.kpis.previousNewInPeriod,
          },
          {
            label: "Growth Rate",
            value: `${data.growthRate.rate >= 0 ? "+" : ""}${data.growthRate.rate}%`,
            numericValue: data.growthRate.rate,
            format: formatSignedPercent,
            icon: IconTrendingUp,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* New Customers Trend */}
        <ReportChartCard
          title="New Customers Over Time"
          description={granularityLabel(granularity)
            .replace("by", "Grouped by")}
          dataTable={{
            caption: "New customers by period",
            columns: ["Period", "New Customers"],
            rows: data.newCustomersTrend.map((p) => [
              p.monthLabel,
              String(p.count),
            ]),
          }}
        >
          {data.newCustomersTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={newCustomersConfig}
              className="h-[280px] w-full"
            >
              <AreaChart
                data={data.newCustomersTrend}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="fillNewCust"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs font-body"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  className="text-xs font-body"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  fill="url(#fillNewCust)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  {...anim}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Active vs Inactive */}
        <ReportChartCard
          title="Active vs Inactive"
          description="Active = a job scheduled in the last 90 days"
          dataTable={{
            caption: "Active versus inactive customers",
            columns: ["Segment", "Customers"],
            rows: activeInactiveData.map((d) => [d.name, String(d.value)]),
          }}
        >
          {activeInactiveData.every((d) => d.value === 0) ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={activeInactiveConfig}
              className="mx-auto h-[280px] w-full"
            >
              <PieChart>
                <ChartTooltip content={PIE_TOOLTIP} />
                <Pie
                  data={activeInactiveData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  {...anim}
                >
                  <Cell fill="hsl(var(--chart-1))" />
                  <Cell fill="hsl(var(--muted-foreground))" />
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Repeat vs One-Time */}
        <ReportChartCard
          title="Repeat vs One-Time Customers"
          dataTable={{
            caption: "Repeat versus one-time customers",
            columns: ["Segment", "Customers"],
            rows: repeatData.map((d) => [d.name, String(d.value)]),
          }}
        >
          {repeatData.every((d) => d.value === 0) ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={repeatConfig}
              className="mx-auto h-[280px] w-full"
            >
              <PieChart>
                <ChartTooltip content={PIE_TOOLTIP} />
                <Pie
                  data={repeatData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  {...anim}
                >
                  <Cell fill="hsl(var(--chart-3))" />
                  <Cell fill="hsl(var(--chart-4))" />
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </ReportChartCard>
      </div>

      {/* Top Customers Table */}
      <ReportDataTable
        title="Top Customers by Job Count"
        viewKey={viewKey}
        columns={[
          { key: "name", label: "Customer" },
          { key: "jobCount", label: "Jobs", align: "right" },
          {
            key: "totalSpent",
            label: "Total Spent",
            align: "right",
            render: (v) => formatCurrency(v as number),
          },
        ]}
        data={data.topCustomersByJobCount}
        rowKey={(row) => row.id}
        rowHref={(row) => `/customers/${row.id}`}
        emptyMessage="No customer data"
      />
    </div>
  );
}
