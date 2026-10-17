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
import { Card } from "@/components/ui/card";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { formatCurrency } from "@/lib/format";
import { ChartDataTable } from "@/components/reusable/chart-data-table";
import { tokenColor } from "@/lib/constants/chart-palette";
import { cn } from "@/lib/utils";
import { ChartTooltipBox } from "./chart-tooltip";
import { WidgetHeader } from "./widget-header";

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
const RANGE_OPTIONS = RANGES.map((r) => ({ value: r, label: r }));

// Collected is the chart's one series, so it takes the first categorical slot
// rather than the UI brand: in dark mode `--chart-1` is a step deeper than
// `--brand`, so the filled band doesn't outweigh everything else on the page.
const COLLECTED_COLOR = tokenColor("chart-1");
// Billed is the ceiling the collected area fills toward, so it stays ink.
const BILLED_COLOR = tokenColor("foreground", 0.55);

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
    <ChartTooltipBox>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {p.monthLabel}
      </div>
      <div className="mt-1 font-heading text-lg font-semibold">
        <span className="tnum">{formatCurrency(p.amount)}</span>
        <span className="ml-1.5 text-[11px] font-body font-normal text-muted-foreground">
          collected
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        <span className="tnum font-mono">{formatCurrency(p.billed)}</span> billed
        {unpaid > 0 && (
          <>
            {" · "}
            <span className="tnum font-mono">{formatCurrency(unpaid)}</span>{" "}
            outstanding
          </>
        )}
      </div>
    </ChartTooltipBox>
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
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <li className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-[2px]"
          style={{ backgroundColor: COLLECTED_COLOR }}
          aria-hidden
        />
        <span className="text-[11px] font-body text-muted-foreground">
          Collected
        </span>
        <span className="tnum font-mono text-[11px] font-medium text-foreground">
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
        <span className="tnum font-mono text-[11px] font-medium text-foreground">
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
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <WidgetHeader
            title="Revenue"
            badge={
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-body uppercase tracking-wide text-muted-foreground">
                {granularity}
              </span>
            }
          />
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tnum font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {formatCurrency(currentValue)}
            </span>
            <span
              className={cn(
                "tnum rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
                isPositive
                  ? "bg-status-good/10 text-status-good-ink"
                  : "bg-status-critical/10 text-status-critical-ink",
              )}
            >
              {isPositive ? "+" : ""}
              {delta}% vs last period
            </span>
          </div>
        </div>
        {/* `range` is null once a custom date range is picked; no option then
            matches `value`, and the tabs show no selection rather than a stale
            one. The group label stands in for the old per-button "Show 1W". */}
        <div role="group" aria-label="Revenue range" className="sm:shrink-0">
          <StatusFilterTabs
            options={RANGE_OPTIONS}
            value={range ?? ""}
            onChange={(v) => {
              const next = RANGES.find((r) => r === v);
              if (next) onRangeChange(next);
            }}
            fullWidthOnMobile
          />
        </div>
      </div>

      <div className="mt-4">
        <SeriesLegend collected={currentValue} billed={billedValue} />
      </div>

      {/* `font-mono` is for the SVG axis ticks, which inherit it: the Y axis is
          money and the X axis is dates, both figures. The tooltip resets it. */}
      <div
        className={cn(
          "relative mt-3 w-full transition-[height]",
          canPlot ? "h-[200px] font-mono sm:h-[260px]" : "h-[150px]",
        )}
        aria-hidden={canPlot}
      >
        {canPlot ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueRangeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLLECTED_COLOR} stopOpacity={0.35} />
                  <stop offset="60%" stopColor={COLLECTED_COLOR} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={COLLECTED_COLOR} stopOpacity={0} />
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
                width={48}
              />
              <Tooltip
                cursor={{ stroke: COLLECTED_COLOR, strokeDasharray: 4, strokeOpacity: 0.6 }}
                content={<TrendTooltip />}
              />
              {/* Billed is the ceiling the collected area is filling toward, so
                  it stays ink rather than taking a second brand-strength hue —
                  the story is the gap between them, not two competing lines.
                  Drawn first, so the filled area reads in front of it. */}
              <Line
                type="monotone"
                dataKey="billed"
                stroke={BILLED_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "hsl(var(--background))",
                  fill: BILLED_COLOR,
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={COLLECTED_COLOR}
                strokeWidth={2.5}
                fill="url(#revenueRangeFill)"
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "hsl(var(--background))",
                  fill: COLLECTED_COLOR,
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
    </Card>
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
    <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 px-4 text-center sm:px-6">
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
    <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 px-4 text-center">
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
