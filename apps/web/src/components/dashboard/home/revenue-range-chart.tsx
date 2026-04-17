"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconChartAreaLine } from "@tabler/icons-react";
import type {
  DashboardRevenueGranularity,
  DashboardRevenueTrendItem,
} from "@hvac-saas/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RevenueRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "ALL";

interface RevenueRangeChartProps {
  data: DashboardRevenueTrendItem[];
  granularity: DashboardRevenueGranularity;
  currentValue: number;
  previousValue: number;
  range: RevenueRange | null;
  onRangeChange: (range: RevenueRange) => void;
}

const RANGES: RevenueRange[] = ["1D", "1W", "1M", "6M", "1Y", "ALL"];

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardRevenueTrendItem }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-2xl bg-foreground/95 px-4 py-3 text-background shadow-2xl ring-1 ring-border">
      <div className="text-[11px] uppercase tracking-wide opacity-70 font-body">
        {p.monthLabel}
      </div>
      <div className="mt-0.5 font-heading text-lg font-semibold">
        {formatCurrency(p.amount)}
      </div>
    </div>
  );
}

export function RevenueRangeChart({
  data,
  granularity,
  currentValue,
  previousValue,
  range,
  onRangeChange,
}: RevenueRangeChartProps) {
  const delta = useMemo(() => {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0;
    return Math.round(((currentValue - previousValue) / previousValue) * 100);
  }, [currentValue, previousValue]);

  const isPositive = delta >= 0;
  const totalRevenue = data.reduce((s, d) => s + d.amount, 0);
  const hasData = totalRevenue > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Subtle brand wash in background */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60"
        style={{
          background:
            "radial-gradient(80% 100% at 50% 0%, hsl(var(--brand) / 0.08) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-body text-muted-foreground">Revenue</span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-body uppercase tracking-wide text-muted-foreground">
              {granularity}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-4xl font-semibold tracking-tight text-foreground">
              {formatCurrency(currentValue)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
                isPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              )}
            >
              {isPositive ? "+" : ""}
              {delta}% vs last period
            </span>
          </div>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          value={range ?? ""}
          onValueChange={(v) => v && onRangeChange(v as RevenueRange)}
          className="rounded-full border border-border/60 bg-muted/40 p-1"
        >
          {RANGES.map((r) => (
            <ToggleGroupItem
              key={r}
              value={r}
              aria-label={`Show ${r}`}
              className="rounded-full px-3 text-xs font-body data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=on]:border data-[state=on]:border-border"
            >
              {r}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="relative mt-4 h-[280px] w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueRangeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="hsl(var(--brand))" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCompact(v)}
                width={56}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--brand))", strokeDasharray: 4, strokeOpacity: 0.6 }}
                content={<TrendTooltip />}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--brand))"
                strokeWidth={2.5}
                fill="url(#revenueRangeFill)"
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "hsl(var(--background))",
                  fill: "hsl(var(--brand))",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyRevenueState />
        )}
      </div>
    </div>
  );
}

function EmptyRevenueState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
        <IconChartAreaLine className="h-5 w-5 text-brand" />
      </div>
      <p className="mt-3 font-heading text-sm font-semibold text-foreground">
        No revenue in this period
      </p>
      <p className="mt-1 max-w-xs text-xs font-body text-muted-foreground">
        Once invoices are paid, your trend will render here. Try a longer range
        like <span className="font-medium">1Y</span> or{" "}
        <span className="font-medium">ALL</span>.
      </p>
    </div>
  );
}
