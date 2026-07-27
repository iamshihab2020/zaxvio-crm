"use client";

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
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { Slide } from "@/components/animate-ui/primitives/effects/slide";

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

interface CustomersTabProps {
  data: CustomerReportData;
  granularity: ReportGranularity;
}

export function CustomersTab({ data, granularity }: CustomersTabProps) {
  const activeInactiveData = [
    { name: "Active", value: data.activeVsInactive.active, key: "active" },
    { name: "Inactive", value: data.activeVsInactive.inactive, key: "inactive" },
  ];

  const repeatData = [
    { name: "Repeat", value: data.repeatVsOneTime.repeat, key: "repeat" },
    { name: "One-Time", value: data.repeatVsOneTime.oneTime, key: "oneTime" },
  ];

  return (
    <div className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Customers",
            value: String(data.kpis.totalCustomers),
            icon: IconUsers,
          },
          {
            label: "New This Period",
            value: String(data.kpis.newInPeriod),
            icon: IconUserPlus,
            currentValue: data.kpis.newInPeriod,
            previousValue: data.kpis.previousNewInPeriod,
          },
          {
            label: "Growth Rate",
            value: `${data.growthRate.rate >= 0 ? "+" : ""}${data.growthRate.rate}%`,
            icon: IconTrendingUp,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* New Customers Trend */}
        <Fade className="h-full" inView inViewOnce delay={0}>
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
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Active vs Inactive */}
        <Fade className="h-full" inView inViewOnce delay={100}>
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
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={activeInactiveData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    <Cell fill="hsl(var(--chart-1))" />
                    <Cell fill="hsl(var(--muted-foreground))" />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Repeat vs One-Time */}
        <Fade className="h-full" inView inViewOnce delay={200}>
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
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={repeatData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    <Cell fill="hsl(var(--chart-3))" />
                    <Cell fill="hsl(var(--chart-4))" />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>
      </div>

      {/* Top Customers Table */}
      <Slide direction="up" inView inViewOnce delay={100}>
        <ReportDataTable
          title="Top Customers by Job Count"
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
      </Slide>
    </div>
  );
}
