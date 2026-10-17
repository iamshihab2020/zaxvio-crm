"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IconChartBar } from "@tabler/icons-react";
import type { DashboardServiceRevenue } from "@hvac-saas/types";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ChartDataTable } from "@/components/reusable/chart-data-table";
import { OTHER_COLOR, tokenColor } from "@/lib/constants/chart-palette";
import { ChartTooltipBox } from "./chart-tooltip";
import { WidgetHeader } from "./widget-header";

interface RevenueByServiceChartProps {
  data: DashboardServiceRevenue[];
}

// One series, so one hue. The bars used to take a different colour each, in
// rank order, which spent the colour channel re-encoding what bar length and
// the axis labels already say, and repainted a service whenever its rank
// changed. The folded "Other" bar is neutral so it never reads as a service.
const BAR_COLOR = tokenColor("chart-1");

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
    <ChartTooltipBox>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {p.label}
        </span>
      </div>
      <div className="tnum mt-0.5 font-heading text-sm font-semibold">
        {formatCurrency(p.amount)} · {pct}%
      </div>
    </ChartTooltipBox>
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
    const withColor = visible.map((r) => ({
      ...r,
      color: r.serviceType === "other" ? OTHER_COLOR : BAR_COLOR,
    }));
    return {
      rows: withColor,
      total: withColor.reduce((s, r) => s + r.amount, 0),
    };
  }, [data]);

  const hasData = total > 0;

  return (
    <Card className="flex h-full flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Revenue by Service"
        action={
          hasData && (
            <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
              <span className="tnum font-mono">{formatCurrency(total)}</span> total
            </span>
          )
        }
      />

      {!hasData ? (
        <div className="mt-4 flex-1 rounded-md border border-dashed border-border bg-muted/10 p-4 text-center sm:p-6">
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
        <div
          aria-hidden
          className="mt-4 flex-1"
          style={{ minHeight: Math.max(160, rows.length * 36) }}
        >
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
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <ChartDataTable
        caption="Revenue by service type"
        columns={["Service", "Revenue", "Share"]}
        rows={rows.map((r) => [
          r.label,
          formatCurrency(r.amount),
          `${total > 0 ? Math.round((r.amount / total) * 100) : 0}%`,
        ])}
      />
    </Card>
  );
}
