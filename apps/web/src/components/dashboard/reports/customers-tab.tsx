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
import {
  BRAND_SERIES,
  STATE_COLORS,
  rampColor,
} from "@/lib/constants/chart-palette";
import { ChartLegendList, areaFill, useFillId } from "./report-palette";

const newCustomersConfig = {
  count: { label: "New Customers", color: BRAND_SERIES },
} satisfies ChartConfig;

// An inactive customer has dropped out, so the warm neutral rather than the
// slate it was, which sat within ΔE 13 of the blue beside it.
const ACTIVE_FILL = BRAND_SERIES;
const INACTIVE_FILL = STATE_COLORS.dropped;

const activeInactiveConfig = {
  active: { label: "Active", color: ACTIVE_FILL },
  inactive: { label: "Inactive", color: INACTIVE_FILL },
} satisfies ChartConfig;

// Repeat customers are the brand, one-time ones its quietest step. These were
// rust and violet.
const REPEAT_FILL = BRAND_SERIES;
const ONE_TIME_FILL = rampColor(1);

const repeatConfig = {
  repeat: { label: "Repeat", color: REPEAT_FILL },
  oneTime: { label: "One-Time", color: ONE_TIME_FILL },
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
      {
        name: "Active",
        value: data.activeVsInactive.active,
        key: "active",
        fill: ACTIVE_FILL,
      },
      {
        name: "Inactive",
        value: data.activeVsInactive.inactive,
        key: "inactive",
        fill: INACTIVE_FILL,
      },
    ],
    [data.activeVsInactive],
  );

  const repeatData = useMemo(
    () => [
      {
        name: "Repeat",
        value: data.repeatVsOneTime.repeat,
        key: "repeat",
        fill: REPEAT_FILL,
      },
      {
        name: "One-Time",
        value: data.repeatVsOneTime.oneTime,
        key: "oneTime",
        fill: ONE_TIME_FILL,
      },
    ],
    [data.repeatVsOneTime],
  );

  const newCustomersFill = useFillId();

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
                {areaFill(newCustomersFill, BRAND_SERIES)}
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
                  fill={`url(#${newCustomersFill})`}
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
            <>
              <ChartContainer
                config={activeInactiveConfig}
                className="mx-auto h-[240px] w-full"
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
                    {activeInactiveData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ChartLegendList
                items={activeInactiveData.map((d) => ({
                  key: d.key,
                  label: d.name,
                  color: d.fill,
                  value: String(d.value),
                }))}
              />
            </>
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
            <>
              <ChartContainer
                config={repeatConfig}
                className="mx-auto h-[240px] w-full"
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
                    {repeatData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ChartLegendList
                items={repeatData.map((d) => ({
                  key: d.key,
                  label: d.name,
                  color: d.fill,
                  value: String(d.value),
                }))}
              />
            </>
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
