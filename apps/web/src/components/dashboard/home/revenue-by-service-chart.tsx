"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IconChartBar } from "@tabler/icons-react";
import type { DashboardServiceRevenue } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";

interface RevenueByServiceChartProps {
  data: DashboardServiceRevenue[];
}

// Brand-aligned palette for non-brand services. First bar always uses brand.
const PALETTE = [
  "hsl(var(--brand))",
  "#fb923c",
  "#fbbf24",
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#f87171",
  "#94a3b8",
];

const MAX_VISIBLE = 6;

function ServiceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; amount: number; color: string } }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  const pct = total > 0 ? Math.round((p.amount / total) * 100) : 0;
  return (
    <div className="rounded-xl bg-foreground/95 px-3 py-2 text-background shadow-lg ring-1 ring-border">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="text-[11px] font-body uppercase tracking-wide opacity-70">
          {p.label}
        </span>
      </div>
      <div className="mt-0.5 font-heading text-sm font-semibold">
        {formatCurrency(p.amount)} · {pct}%
      </div>
    </div>
  );
}

export function RevenueByServiceChart({ data }: RevenueByServiceChartProps) {
  const { rows, total } = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.amount - a.amount);
    const visible = sorted.slice(0, MAX_VISIBLE);
    const rest = sorted.slice(MAX_VISIBLE);
    if (rest.length > 0) {
      visible.push({
        serviceType: "other",
        label: `Other (${rest.length})`,
        amount: rest.reduce((s, r) => s + r.amount, 0),
      });
    }
    const withColor = visible.map((r, i) => ({
      ...r,
      color: PALETTE[i % PALETTE.length]!,
    }));
    return {
      rows: withColor,
      total: withColor.reduce((s, r) => s + r.amount, 0),
    };
  }, [data]);

  const hasData = total > 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Revenue by Service
        </h3>
        {hasData && (
          <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
            {formatCurrency(total)} total
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="mt-4 flex-1 rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <IconChartBar className="h-5 w-5 text-brand" />
          </div>
          <p className="mt-3 font-heading text-sm font-semibold text-foreground">
            No revenue yet
          </p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            Paid invoices will group by service type here.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex-1" style={{ minHeight: Math.max(160, rows.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                content={<ServiceTooltip total={total} />}
              />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
