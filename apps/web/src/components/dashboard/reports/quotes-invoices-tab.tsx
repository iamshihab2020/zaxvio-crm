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
  IconFileDescription,
  IconReceipt,
  IconPercentage,
  IconClock,
} from "@tabler/icons-react";
import type { QuoteInvoiceReportData } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

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

const AGING_COLORS = ["hsl(var(--chart-1))", "#f59e0b", "#f97316", "#ef4444"];

const funnelConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const overdueConfig = {
  count: { label: "Overdue Invoices", color: "#ef4444" },
} satisfies ChartConfig;

interface QuotesInvoicesTabProps {
  data: QuoteInvoiceReportData;
}

export function QuotesInvoicesTab({ data }: QuotesInvoicesTabProps) {
  const invoiceStatusConfig: ChartConfig = {};
  data.invoiceStatusDistribution.forEach((s) => {
    invoiceStatusConfig[s.status] = {
      label: s.label,
      color: INVOICE_COLORS[s.status] ?? "#6b7280",
    };
  });

  return (
    <div className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Quote Conversion",
            value: `${data.quoteKpis.conversionRate}%`,
            icon: IconPercentage,
            currentValue: data.quoteKpis.conversionRate,
            previousValue: data.quoteKpis.previousConversionRate,
          },
          {
            label: "Total Invoiced",
            value: formatCurrency(data.invoiceKpis.totalInvoiced),
            icon: IconReceipt,
          },
          {
            label: "Collection Rate",
            value: `${data.invoiceKpis.collectionRate}%`,
            icon: IconPercentage,
          },
          {
            label: "Avg Days to Payment",
            value: String(data.avgDaysToPayment),
            icon: IconClock,
            suffix: "days",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Quote Conversion Funnel */}
        <Fade className="h-full" inView inViewOnce delay={0}>
          <ReportChartCard
            title="Quote Conversion Funnel"
            description={`${data.quoteKpis.totalQuotes} quotes, ${formatCurrency(data.quoteKpis.totalValue)} total value`}
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
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
        </Fade>

        {/* Invoice Status Distribution */}
        <Fade className="h-full" inView inViewOnce delay={100}>
          <ReportChartCard title="Invoice Status Distribution">
            {data.invoiceStatusDistribution.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={invoiceStatusConfig}
                className="mx-auto h-[280px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={data.invoiceStatusDistribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
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
        </Fade>

        {/* Invoice Aging */}
        <Fade className="h-full" inView inViewOnce delay={200}>
          <ReportChartCard title="Invoice Aging">
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
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(pct, 3)}%`,
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
        </Fade>

        {/* Overdue Invoice Trend */}
        <Fade className="h-full" inView inViewOnce delay={300}>
          <ReportChartCard title="Overdue Invoice Trend">
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
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>
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
