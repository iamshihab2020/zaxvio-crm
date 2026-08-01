"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
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
import { ChartDataTable } from "@/components/reusable/chart-data-table";
import { cn } from "@/lib/utils";

export type RevenueRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "ALL";

interface RevenueRangeChartProps {
  data: DashboardRevenueTrendItem[];
  granularity: DashboardRevenueGranularity;
  currentValue: number;
  previousValue: number;
  /** Face value of invoices issued in the same range. */
  billedValue: number;
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
  const unpaid = p.billed - p.amount;
  return (
    <div className="rounded-2xl bg-foreground/95 px-4 py-3 text-background shadow-2xl ring-1 ring-border">
      <div className="text-[11px] uppercase tracking-wide opacity-70 font-body">
        {p.monthLabel}
      </div>
      <div className="mt-1 font-heading text-lg font-semibold">
        {formatCurrency(p.amount)}
        <span className="ml-1.5 text-[11px] font-body font-normal opacity-70">
          collected
        </span>
      </div>
      <div className="mt-0.5 text-[11px] font-body opacity-80">
        {formatCurrency(p.billed)} billed
        {unpaid > 0 ? ` · ${formatCurrency(unpaid)} outstanding` : ""}
      </div>
    </div>
  );
}

/** Legend doubles as the value readout, so the two series are never colour-alone. */
function SeriesLegend({
  collected,
  billed,
}: {
  collected: number;
  billed: number;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      <li className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-[2px] bg-brand"
          aria-hidden
        />
        <span className="text-[11px] font-body text-muted-foreground">
          Collected
        </span>
        <span className="tnum text-[11px] font-body font-medium text-foreground">
          {formatCurrency(collected)}
        </span>
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="h-0 w-3 border-t-2 border-dashed border-foreground/55"
          aria-hidden
        />
        <span className="text-[11px] font-body text-muted-foreground">
          Billed
        </span>
        <span className="tnum text-[11px] font-body font-medium text-foreground">
          {formatCurrency(billed)}
        </span>
      </li>
    </ul>
  );
}

export function RevenueRangeChart({
  data,
  granularity,
  currentValue,
  previousValue,
  billedValue,
  range,
  onRangeChange,
}: RevenueRangeChartProps) {
  const delta = useMemo(() => {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0;
    return Math.round(((currentValue - previousValue) / previousValue) * 100);
  }, [currentValue, previousValue]);

  const isPositive = delta >= 0;
  /**
   * Plot whenever *either* series has something to say. Judging emptiness on
   * collected alone would blank a period where every invoice went out and none
   * came back — the one period a contractor most needs to see.
   */
  const hasData = data.some((d) => d.amount > 0 || d.billed > 0);
  /**
   * An area chart needs at least two points to express anything. With one
   * bucket — the default month-to-date range at month granularity is exactly
   * one — Recharts drew a lone dot in a 280px canvas, so the largest element on
   * the dashboard was 280px of empty grid. Plot only when there is a shape to
   * plot; otherwise state the figure and say what would produce a trend.
   */
  const canPlot = hasData && data.length >= 2;

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

      <div className="relative mt-4">
        <SeriesLegend collected={currentValue} billed={billedValue} />
      </div>

      <div
        className={cn(
          "relative mt-3 w-full transition-[height]",
          canPlot ? "h-[280px]" : "h-[150px]",
        )}
        aria-hidden={canPlot}
      >
        {canPlot ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
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
              {/* Billed is the ceiling the collected area is filling toward, so
                  it stays ink rather than taking a second brand-strength hue —
                  the story is the gap between them, not two competing lines.
                  Drawn first, so the filled area reads in front of it. */}
              <Line
                type="monotone"
                dataKey="billed"
                stroke="hsl(var(--foreground) / 0.55)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "hsl(var(--background))",
                  fill: "hsl(var(--foreground) / 0.55)",
                }}
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
            </ComposedChart>
          </ResponsiveContainer>
        ) : hasData ? (
          <SingleBucketState
            label={data[0]?.monthLabel ?? ""}
            granularity={granularity}
          />
        ) : (
          <EmptyRevenueState />
        )}
      </div>

      <ChartDataTable
        caption={`Collected and billed by ${granularity}`}
        columns={["Period", "Collected", "Billed"]}
        rows={data.map((d) => [
          d.monthLabel,
          formatCurrency(d.amount),
          formatCurrency(d.billed),
        ])}
      />
    </div>
  );
}

/**
 * Shown when the range resolves to a single bucket: there is revenue, but one
 * point is a number, not a trend. Says so, and points at the control that
 * fixes it.
 */
function SingleBucketState({
  label,
  granularity,
}: {
  label: string;
  granularity: DashboardRevenueGranularity;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 text-center">
      <p className="font-heading text-sm font-semibold text-foreground">
        One {granularity} of revenue{label ? ` — ${label}` : ""}
      </p>
      <p className="mt-1 max-w-sm text-xs font-body text-muted-foreground">
        A trend line needs at least two {granularity}s. Widen the range above —{" "}
        <span className="font-medium text-foreground">6M</span>,{" "}
        <span className="font-medium text-foreground">1Y</span> or{" "}
        <span className="font-medium text-foreground">ALL</span> — to see the
        shape over time.
      </p>
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
