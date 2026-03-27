"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardRevenueTrendItem } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const chartConfig = {
  amount: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface RevenueChartProps {
  data: DashboardRevenueTrendItem[];
  currentMonthRevenue?: number;
  previousMonthRevenue?: number;
  title?: string;
}

export function RevenueChart({
  data,
  currentMonthRevenue,
  previousMonthRevenue,
  title = "Revenue",
}: RevenueChartProps) {
  const hasData = data.some((d) => d.amount > 0);
  const average = hasData
    ? data.reduce((sum, d) => sum + d.amount, 0) / data.length
    : 0;

  // Trend
  const showTrend =
    currentMonthRevenue !== undefined && previousMonthRevenue !== undefined;
  let trendPct = 0;
  let trendUp = true;
  if (showTrend && previousMonthRevenue! > 0) {
    trendPct = Math.round(
      ((currentMonthRevenue! - previousMonthRevenue!) / previousMonthRevenue!) * 100,
    );
    trendUp = trendPct >= 0;
    trendPct = Math.abs(trendPct);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base font-semibold">
            {title}
          </CardTitle>
          {showTrend && currentMonthRevenue! > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-lg font-bold text-foreground">
                {formatCurrency(currentMonthRevenue!)}
              </span>
              {previousMonthRevenue! > 0 && (
                <div
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
                    trendUp
                      ? "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                      : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
                  )}
                >
                  {trendUp ? (
                    <IconTrendingUp className="h-3 w-3" />
                  ) : (
                    <IconTrendingDown className="h-3 w-3" />
                  )}
                  {trendPct}%
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm text-muted-foreground font-body">
              No payments recorded yet
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-amount)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-amount)"
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
                    formatter={(value) => formatCurrency(value as number)}
                  />
                }
              />
              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Avg: ${formatCurrency(average)}`,
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--color-amount)"
                fill="url(#fillRevenue)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
