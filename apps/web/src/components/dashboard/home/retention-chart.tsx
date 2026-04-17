"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardRetentionPoint } from "@hvac-saas/types";
import { cn } from "@/lib/utils";

interface RetentionChartProps {
  data: DashboardRetentionPoint[];
}

function RetentionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DashboardRetentionPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-xl bg-foreground/95 px-3 py-2 text-background shadow-lg">
      <div className="text-[11px] uppercase tracking-wide opacity-70 font-body">
        {p.monthLabel}
      </div>
      <div className="mt-0.5 font-heading text-sm font-semibold">
        {p.repeatRate}% repeat
      </div>
      <div className="text-[11px] font-body opacity-80">
        {p.repeatCount} of {p.totalCount} customers
      </div>
    </div>
  );
}

export function RetentionChart({ data }: RetentionChartProps) {
  const latest = data.at(-1);
  const prev = data.length >= 2 ? data[data.length - 2] : undefined;
  const delta =
    latest && prev && prev.repeatRate > 0
      ? latest.repeatRate - prev.repeatRate
      : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Retention Rate
          </h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-semibold text-foreground">
              {latest ? `${latest.repeatRate}%` : "—"}
            </span>
            {latest && prev && (
              <span
                className={cn(
                  "text-[11px] font-body",
                  delta >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {delta >= 0 ? "+" : ""}
                {delta}% vs last month
              </span>
            )}
          </div>
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-body text-muted-foreground">
          Repeat customers
        </span>
      </div>

      <div className="mt-4 min-h-[180px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0.45} />
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
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
              width={44}
            />
            <Tooltip cursor={{ fill: "hsl(var(--brand) / 0.08)" }} content={<RetentionTooltip />} />
            <Bar
              dataKey="repeatRate"
              fill="url(#retentionFill)"
              radius={[8, 8, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
