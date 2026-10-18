"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardRetentionPoint } from "@hvac-saas/types";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { WidgetWindowBadge } from "./widget-window-badge";
import { ChartDataTable } from "@/components/reusable/chart-data-table";
import { BRAND_SERIES, tokenColor } from "@/lib/constants/chart-palette";
import { barFill, useFillId } from "@/components/dashboard/reusable/chart-fills";
import { cn } from "@/lib/utils";
import { ChartTooltipBox } from "./chart-tooltip";
import { chartAnimation } from "./chart-motion";
import { WidgetHeader } from "./widget-header";

interface RetentionChartProps {
  data: DashboardRetentionPoint[];
}

// One series, one hue: the brand. The bars used to fade to 45% opacity at the
// base, which left the baseline, where a bar's height is read from, the
// faintest part of it. They shade again since 2026-10-19 (the user asked for
// brand gradients, and /reports has the same), but from 65%, so the base still
// reads as the bar.
const BAR_COLOR = BRAND_SERIES;

function RetentionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DashboardRetentionPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <ChartTooltipBox>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {p.monthLabel}
      </div>
      <div className="mt-0.5 text-sm">
        <span className="tnum font-heading font-semibold">{p.repeatRate}%</span> repeat
      </div>
      <div className="text-[11px] text-muted-foreground">
        <span className="tnum font-mono">{p.repeatCount}</span> of{" "}
        <span className="tnum font-mono">{p.totalCount}</span> customers
      </div>
    </ChartTooltipBox>
  );
}

export function RetentionChart({ data }: RetentionChartProps) {
  const latest = data.at(-1);
  const prev = data.length >= 2 ? data[data.length - 2] : undefined;
  const delta =
    latest && prev && prev.repeatRate > 0
      ? latest.repeatRate - prev.repeatRate
      : 0;
  const anim = chartAnimation();
  const fillId = useFillId();

  return (
    <Card data-widget="retention" className="flex h-full flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Retention Rate"
        badge={<WidgetWindowBadge label="Last 6 months" />}
        action={
          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-body text-muted-foreground">
            Repeat customers
          </span>
        }
      />
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tnum font-heading text-2xl font-bold text-foreground">
          {latest ? (
            <AnimatedNumber value={latest.repeatRate} format={(n) => `${n}%`} />
          ) : (
            "—"
          )}
        </span>
        {latest && prev && (
          <span
            className={cn(
              "tnum text-[11px] font-body",
              delta >= 0 ? "text-status-good-ink" : "text-status-critical-ink",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta}% vs last month
          </span>
        )}
      </div>

      {/* Chart is decorative for assistive tech; the same numbers are listed below it.
          `font-mono` is for the SVG axis ticks (months and percentages are
          figures); the tooltip resets it. */}
      <div className="mt-4 min-h-[180px] w-full flex-1 font-mono" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            {barFill(fillId, BAR_COLOR, "up")}
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
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
              width={44}
            />
            <Tooltip cursor={{ fill: tokenColor("chart-1", 0.08) }} content={<RetentionTooltip />} />
            <Bar
              dataKey="repeatRate"
              fill={`url(#${fillId})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              {...anim}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartDataTable
        caption="Repeat-customer rate by month"
        columns={["Month", "Repeat rate", "Repeat customers", "Total customers"]}
        rows={data.map((d) => [
          d.monthLabel,
          `${d.repeatRate}%`,
          String(d.repeatCount),
          String(d.totalCount),
        ])}
      />
    </Card>
  );
}
