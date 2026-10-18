"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconReceipt,
  IconPercentage,
  IconClock,
} from "@tabler/icons-react";
import type { QuoteInvoiceReportData, ReportGranularity } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { staggerDelay } from "@/lib/motion";
import {
  chartAnimation,
  enterDelay,
} from "@/components/dashboard/home/chart-motion";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";

const QUOTE_COLORS: Record<string, string> = {
  sent: "#3b82f6",
  accepted: "#22c55e",
  declined: "#ef4444",
  expired: "#6b7280",
  draft: "#a3a3a3",
};

const INVOICE_COLORS: Record<string, string> = {
  paid: "#22c55e",
  sent: "#3b82f6",
  partially_paid: "#f59e0b",
  overdue: "#ef4444",
  draft: "#a3a3a3",
  void: "#6b7280",
};

/**
 * One colour per aging bucket. There are five buckets since the dashboard pass
 * split 61–90 out of "90+"; a four-entry list left the last one falling back to
 * grey, which read as "no data" rather than "worst".
 *
 * Tokens, the same ones the dashboard's Invoice Aging uses: current is good,
 * then one red darkening with age. This list used to start on the brand
 * (orange, then blue after the rebrand), which made "current" look like the
 * first of the overdue buckets, and its hex steps followed no theme.
 */
const AGING_COLORS = [
  "hsl(var(--status-good))",
  "hsl(var(--overdue-1))",
  "hsl(var(--overdue-2))",
  "hsl(var(--overdue-3))",
  "hsl(var(--overdue-4))",
];

const funnelConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const overdueConfig = {
  count: { label: "Overdue Invoices", color: "#ef4444" },
} satisfies ChartConfig;

// Stable for the pie below: see CURRENCY_TOOLTIP in revenue-tab.tsx for why a
// pie's tooltip element must not be rebuilt on every render.
const PIE_TOOLTIP = <ChartTooltipContent />;

const formatPercent = (n: number) => `${n}%`;
const formatCount = (n: number) => String(n);

/** The aging bars draw in one after another, 50ms apart. */
const BAR_STEP = 50;
const BAR_MAX_STEPS = 5;

interface QuotesInvoicesTabProps {
  data: QuoteInvoiceReportData;
  granularity: ReportGranularity;
}

export function QuotesInvoicesTab({
  data,
  granularity,
}: QuotesInvoicesTabProps) {
  const invoiceStatusConfig: ChartConfig = {};
  data.invoiceStatusDistribution.forEach((s) => {
    invoiceStatusConfig[s.status] = {
      label: s.label,
      color: INVOICE_COLORS[s.status] ?? "#6b7280",
    };
  });

  const anim = chartAnimation();

  return (
    <div data-stagger className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Quote Conversion",
            value: `${data.quoteKpis.conversionRate}%`,
            numericValue: data.quoteKpis.conversionRate,
            format: formatPercent,
            icon: IconPercentage,
            currentValue: data.quoteKpis.conversionRate,
            previousValue: data.quoteKpis.previousConversionRate,
          },
          {
            label: "Total Invoiced",
            value: formatCurrency(data.invoiceKpis.totalInvoiced),
            numericValue: data.invoiceKpis.totalInvoiced,
            format: formatCurrency,
            icon: IconReceipt,
          },
          {
            label: "Collection Rate",
            value: `${data.invoiceKpis.collectionRate}%`,
            numericValue: data.invoiceKpis.collectionRate,
            format: formatPercent,
            icon: IconPercentage,
          },
          {
            label: "Avg Days to Payment",
            value: String(data.avgDaysToPayment),
            numericValue: data.avgDaysToPayment,
            format: formatCount,
            icon: IconClock,
            suffix: "days",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Quote Conversion Funnel */}
        <ReportChartCard
          title="Quote Conversion Funnel"
          description={`${data.quoteKpis.totalQuotes} quotes, ${formatCurrency(data.quoteKpis.totalValue)} total value`}
          dataTable={{
            caption: "Quotes by status",
            columns: ["Status", "Quotes", "Value"],
            rows: data.quoteConversionFunnel.map((q) => [
              q.label,
              String(q.count),
              formatCurrency(q.value),
            ]),
          }}
        >
          {data.quoteConversionFunnel.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={funnelConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={data.quoteConversionFunnel}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs font-body"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  className="text-xs font-body"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const row = item?.payload;
                        return `${value} quotes (${formatCurrency(row?.value ?? 0)})`;
                      }}
                    />
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} {...anim}>
                  {data.quoteConversionFunnel.map((item) => (
                    <Cell
                      key={item.status}
                      fill={QUOTE_COLORS[item.status] ?? "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Invoice Status Distribution */}
        <ReportChartCard
          title="Invoice Status Distribution"
          dataTable={{
            caption: "Invoices by status",
            columns: ["Status", "Invoices"],
            rows: data.invoiceStatusDistribution.map((s) => [
              s.label,
              String(s.count),
            ]),
          }}
        >
          {data.invoiceStatusDistribution.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={invoiceStatusConfig}
              className="mx-auto h-[280px] w-full"
            >
              <PieChart>
                <ChartTooltip content={PIE_TOOLTIP} />
                <Pie
                  data={data.invoiceStatusDistribution}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  {...anim}
                >
                  {data.invoiceStatusDistribution.map((s) => (
                    <Cell
                      key={s.status}
                      fill={INVOICE_COLORS[s.status] ?? "#6b7280"}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Invoice Aging */}
        <ReportChartCard
          title="Invoice Aging"
          description="All unpaid invoices — ignores the date range above"
          dataTable={{
            caption: "Unpaid invoices by age",
            columns: ["Bucket", "Invoices", "Amount"],
            rows: data.invoiceAgingDetail.map((b) => [
              b.label,
              String(b.count),
              formatCurrency(b.amount),
            ]),
          }}
        >
          {data.invoiceAgingDetail.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="space-y-3 py-2">
              {data.invoiceAgingDetail.map((bucket, i) => {
                const maxAmount = Math.max(
                  ...data.invoiceAgingDetail.map((b) => b.amount),
                );
                const pct =
                  maxAmount > 0 ? (bucket.amount / maxAmount) * 100 : 0;
                return (
                  <div key={bucket.bucket} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">
                        {bucket.label}
                      </span>
                      <span className="font-medium">
                        {bucket.count} invoices ·{" "}
                        {formatCurrency(bucket.amount)}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      {/* Full width, scaled to the share: it draws in and
                          re-sizes on `transform` alone. */}
                      <div
                        className="motion-grow-x h-full w-full rounded-full motion-safe:transition-transform motion-safe:duration-[var(--dur-focal)] motion-safe:ease-[var(--ease-out)]"
                        style={{
                          ...enterDelay(staggerDelay(i, BAR_STEP, BAR_MAX_STEPS)),
                          transform: `scaleX(${Math.max(pct, 3) / 100})`,
                          backgroundColor: AGING_COLORS[i] ?? "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ReportChartCard>

        {/* Overdue Invoice Trend */}
        <ReportChartCard
          title="Overdue Invoice Trend"
          description={`Unpaid and past due, by due date, ${granularityLabel(granularity)}`}
          dataTable={{
            caption: "Overdue invoices by due-date period",
            columns: ["Period", "Overdue Invoices"],
            rows: data.overdueInvoiceTrend.map((p) => [
              p.monthLabel,
              String(p.count),
            ]),
          }}
        >
          {data.overdueInvoiceTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={overdueConfig}
              className="h-[280px] w-full"
            >
              <AreaChart
                data={data.overdueInvoiceTrend}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="fillOverdue"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop
                      offset="95%"
                      stopColor="#ef4444"
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
                  stroke="#ef4444"
                  fill="url(#fillOverdue)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  {...anim}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </ReportChartCard>
      </div>
    </div>
  );
}
