"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconCash,
  IconReceipt,
  IconPercentage,
  IconChartBar,
} from "@tabler/icons-react";
import type { ReportGranularity, RevenueReportData } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { chartAnimation } from "@/components/dashboard/home/chart-motion";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--brand))",
  "#6366f1",
];

const revenueTrendConfig = {
  current: { label: "Current Period", color: "hsl(var(--chart-1))" },
  previous: { label: "Previous Period", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

const serviceTypeConfig = {
  amount: { label: "Revenue", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const avgJobConfig = {
  avgValue: { label: "Avg Job Value", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const formatPercent = (n: number) => `${n}%`;

// One element for the life of the module, not built inside the pie's chart.
// Recharts decides whether a pie's children changed by comparing their props
// one level deep, and a `content` element made on every render is never equal
// to the last one, which restarts the draw-in each time the tab re-renders (a
// refetch flipping `isFetching` is enough). Charts with `data` on the chart
// itself are not affected; pies keep theirs on the `Pie`.
const CURRENCY_TOOLTIP = (
  <ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />
);

interface RevenueTabProps {
  data: RevenueReportData;
  granularity: ReportGranularity;
  /** Section and range these figures belong to; the table re-lays rows on it. */
  viewKey: string;
}

export function RevenueTab({ data, granularity, viewKey }: RevenueTabProps) {
  const paymentMethodConfig = useMemo(() => {
    const config: ChartConfig = {};
    data.revenueByPaymentMethod.forEach((item, i) => {
      config[item.method] = {
        label: item.label,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    return config;
  }, [data.revenueByPaymentMethod]);

  const anim = chartAnimation();

  return (
    <div data-stagger className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Revenue Collected",
            value: formatCurrency(data.kpis.totalRevenue),
            numericValue: data.kpis.totalRevenue,
            format: formatCurrency,
            icon: IconCash,
            currentValue: data.kpis.totalRevenue,
            previousValue: data.kpis.previousRevenue,
            hint: "Payments received in this period",
          },
          {
            // Two different meanings of money used to sit side by side here
            // unlabelled: "Total Revenue" is cash collected, this is the value
            // of work booked, whether or not it has been paid for.
            label: "Avg Job Value",
            value: formatCurrency(data.kpis.avgJobValue),
            numericValue: data.kpis.avgJobValue,
            format: formatCurrency,
            icon: IconChartBar,
            currentValue: data.kpis.avgJobValue,
            previousValue: data.kpis.previousAvgJobValue,
            hint: "Booked value per job, not yet collected",
          },
          {
            label: "Collection Rate",
            value: `${data.collectionRate.rate}%`,
            numericValue: data.collectionRate.rate,
            format: formatPercent,
            icon: IconPercentage,
            hint: "Of everything invoiced in this period",
          },
          {
            label: "Total Invoiced",
            value: formatCurrency(data.collectionRate.totalInvoiced),
            numericValue: data.collectionRate.totalInvoiced,
            format: formatCurrency,
            icon: IconReceipt,
            hint: "Invoices issued in this period",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Revenue Trend with comparison */}
        <ReportChartCard
          title="Revenue Trend"
          description={`Current vs previous period, ${granularityLabel(granularity)}`}
          dataTable={{
            caption: "Revenue by period, current versus previous",
            columns: ["Period", "Current", "Compared with", "Previous"],
            rows: data.revenueTrend.map((p) => [
              p.monthLabel,
              formatCurrency(p.current),
              p.previousLabel ?? "—",
              p.previous === null ? "—" : formatCurrency(p.previous),
            ]),
          }}
        >
          {data.revenueTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={revenueTrendConfig}
              className="h-[280px] w-full"
            >
              <AreaChart
                data={data.revenueTrend}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="fillRevCurrent"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-current)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-current)"
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
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  className="text-xs font-body"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        value === null ? "—" : formatCurrency(value as number)
                      }
                    />
                  }
                />
                {/* `previous` is null when a bucket has no counterpart, so the
                    line breaks rather than dropping to a false zero. */}
                <Area
                  type="monotone"
                  dataKey="previous"
                  stroke="var(--color-previous)"
                  fill="transparent"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  {...anim}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="var(--color-current)"
                  fill="url(#fillRevCurrent)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  {...anim}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Revenue by Service Type */}
        <ReportChartCard
          title="Revenue by Service Type"
          dataTable={{
            caption: "Revenue by service type",
            columns: ["Service Type", "Revenue"],
            rows: data.revenueByServiceType.map((r) => [
              r.label,
              formatCurrency(r.amount),
            ]),
          }}
        >
          {data.revenueByServiceType.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={serviceTypeConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={data.revenueByServiceType}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  tickLine={false}
                  axisLine={false}
                  className="text-xs font-body"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={90}
                  className="text-xs font-body"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  }
                />
                <Bar
                  dataKey="amount"
                  fill="var(--color-amount)"
                  radius={[0, 4, 4, 0]}
                  {...anim}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Revenue by Payment Method */}
        <ReportChartCard
          title="Revenue by Payment Method"
          dataTable={{
            caption: "Revenue by payment method",
            columns: ["Payment Method", "Revenue"],
            rows: data.revenueByPaymentMethod.map((r) => [
              r.label,
              formatCurrency(r.amount),
            ]),
          }}
        >
          {data.revenueByPaymentMethod.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={paymentMethodConfig}
              className="mx-auto h-[280px] w-full"
            >
              <PieChart>
                <ChartTooltip content={CURRENCY_TOOLTIP} />
                <Pie
                  data={data.revenueByPaymentMethod}
                  dataKey="amount"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  {...anim}
                >
                  {data.revenueByPaymentMethod.map((slice, i) => (
                    <Cell
                      key={slice.method}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Avg Job Value Trend */}
        <ReportChartCard
          title="Average Job Value"
          description={`Booked value per job, ${granularityLabel(granularity)}`}
          dataTable={{
            caption: "Average booked job value by period",
            columns: ["Period", "Avg Job Value"],
            rows: data.avgJobValueTrend.map((r) => [
              r.monthLabel,
              formatCurrency(r.avgValue),
            ]),
          }}
        >
          {data.avgJobValueTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer config={avgJobConfig} className="h-[280px] w-full">
              <LineChart
                data={data.avgJobValueTrend}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs font-body"
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  className="text-xs font-body"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="avgValue"
                  stroke="var(--color-avgValue)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  {...anim}
                />
              </LineChart>
            </ChartContainer>
          )}
        </ReportChartCard>
      </div>

      {/* Collection Rate + Top Customers */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ReportChartCard title="Collection Rate">
          <div className="space-y-3 py-4">
            <div className="flex items-end justify-between">
              <span className="font-heading text-3xl font-bold text-foreground">
                <AnimatedNumber
                  value={data.collectionRate.rate}
                  format={formatPercent}
                />
              </span>
              <span className="text-xs text-muted-foreground font-body">
                {formatCurrency(data.collectionRate.totalCollected)} of{" "}
                {formatCurrency(data.collectionRate.totalInvoiced)}
              </span>
            </div>
            <Progress
              value={data.collectionRate.rate}
              className="h-2"
              aria-label={`Collection rate ${data.collectionRate.rate} percent`}
            />
          </div>
        </ReportChartCard>

        <ReportDataTable
          title="Top Customers by Revenue"
          className="md:col-span-2"
          viewKey={viewKey}
          columns={[
            { key: "name", label: "Customer" },
            {
              key: "revenue",
              label: "Revenue",
              align: "right",
              render: (v) => formatCurrency(v as number),
            },
            { key: "jobCount", label: "Jobs", align: "right" },
          ]}
          data={data.topCustomersByRevenue}
          rowKey={(row) => row.id}
          rowHref={(row) => `/customers/${row.id}`}
          emptyMessage="No customer revenue data"
        />
      </div>
    </div>
  );
}
