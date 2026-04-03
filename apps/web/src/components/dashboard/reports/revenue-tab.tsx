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
import type { RevenueReportData } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { Slide } from "@/components/animate-ui/primitives/effects/slide";

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

interface RevenueTabProps {
  data: RevenueReportData;
}

export function RevenueTab({ data }: RevenueTabProps) {
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

  return (
    <div className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Revenue",
            value: formatCurrency(data.kpis.totalRevenue),
            icon: IconCash,
            currentValue: data.kpis.totalRevenue,
            previousValue: data.kpis.previousRevenue,
          },
          {
            label: "Avg Job Value",
            value: formatCurrency(data.kpis.avgJobValue),
            icon: IconChartBar,
          },
          {
            label: "Collection Rate",
            value: `${data.collectionRate.rate}%`,
            icon: IconPercentage,
          },
          {
            label: "Total Invoiced",
            value: formatCurrency(data.collectionRate.totalInvoiced),
            icon: IconReceipt,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Revenue Trend with comparison */}
        <Fade className="h-full" inView inViewOnce delay={0}>
          <ReportChartCard
            title="Revenue Trend"
            description="Current vs previous period"
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
                          formatCurrency(value as number)
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="previous"
                    stroke="var(--color-previous)"
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="current"
                    stroke="var(--color-current)"
                    fill="url(#fillRevCurrent)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Revenue by Service Type */}
        <Fade className="h-full" inView inViewOnce delay={100}>
          <ReportChartCard title="Revenue by Service Type">
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
                        formatter={(value) =>
                          formatCurrency(value as number)
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="amount"
                    fill="var(--color-amount)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Revenue by Payment Method */}
        <Fade className="h-full" inView inViewOnce delay={200}>
          <ReportChartCard title="Revenue by Payment Method">
            {data.revenueByPaymentMethod.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={paymentMethodConfig}
                className="mx-auto h-[280px] w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          formatCurrency(value as number)
                        }
                      />
                    }
                  />
                  <Pie
                    data={data.revenueByPaymentMethod}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {data.revenueByPaymentMethod.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Avg Job Value Trend */}
        <Fade className="h-full" inView inViewOnce delay={300}>
          <ReportChartCard title="Average Job Value">
            {data.avgJobValueTrend.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={avgJobConfig}
                className="h-[280px] w-full"
              >
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
                        formatter={(value) =>
                          formatCurrency(value as number)
                        }
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
                  />
                </LineChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>
      </div>

      {/* Collection Rate + Top Customers */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Fade className="h-full" inView inViewOnce delay={0}>
          <ReportChartCard title="Collection Rate">
            <div className="space-y-3 py-4">
              <div className="flex items-end justify-between">
                <span className="font-heading text-3xl font-bold text-foreground">
                  {data.collectionRate.rate}%
                </span>
                <span className="text-xs text-muted-foreground font-body">
                  {formatCurrency(data.collectionRate.totalCollected)} of{" "}
                  {formatCurrency(data.collectionRate.totalInvoiced)}
                </span>
              </div>
              <Progress value={data.collectionRate.rate} className="h-2" />
            </div>
          </ReportChartCard>
        </Fade>

        <Slide direction="up" inView inViewOnce delay={100} className="md:col-span-2">
          <ReportDataTable
            title="Top Customers by Revenue"
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
            emptyMessage="No customer revenue data"
          />
        </Slide>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <p className="text-sm text-muted-foreground font-body">
        No data for this period
      </p>
    </div>
  );
}
