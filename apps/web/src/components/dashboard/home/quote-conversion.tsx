"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { IconFileDescription } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { DashboardQuoteSummary } from "@hvac-saas/types";

interface QuoteConversionProps {
  data: DashboardQuoteSummary;
}

const SEGMENT_CONFIG = [
  { key: "accepted" as const, label: "Accepted", color: "#22c55e" },
  { key: "declined" as const, label: "Declined", color: "#ef4444" },
  { key: "pending" as const, label: "Pending", color: "#fbbf24" },
];

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; color: string } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-xl bg-foreground/95 px-3 py-2 text-background shadow-lg ring-1 ring-border">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="text-[11px] font-body uppercase tracking-wide opacity-70">
          {p.name}
        </span>
      </div>
      <div className="mt-0.5 font-heading text-sm font-semibold">
        {p.value} {p.value === 1 ? "quote" : "quotes"}
      </div>
    </div>
  );
}

export function QuoteConversion({ data }: QuoteConversionProps) {
  const chartData = SEGMENT_CONFIG.map((s) => ({
    name: s.label,
    value: data[s.key],
    color: s.color,
  })).filter((d) => d.value > 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Quote Funnel
        </h3>
        <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
          {data.totalQuotes} {data.totalQuotes === 1 ? "quote" : "quotes"}
        </span>
      </div>

      {data.totalQuotes === 0 ? (
        <div className="mt-4 flex-1 rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <IconFileDescription className="h-5 w-5 text-brand" />
          </div>
          <p className="mt-3 font-heading text-sm font-semibold text-foreground">
            No quotes in this period
          </p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            Send a quote from a customer&apos;s profile to track it here.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center gap-5">
          {/* Donut chart with centered conversion % — values repeated in the legend */}
          <div className="relative h-[140px] w-[140px] shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={66}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<FunnelTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {data.conversionRate}%
              </span>
              <span className="text-[10px] font-body uppercase tracking-wide text-muted-foreground">
                conversion
              </span>
            </div>
          </div>

          {/* Legend with counts */}
          <ul className="flex-1 space-y-2">
            {SEGMENT_CONFIG.map((s) => {
              const value = data[s.key];
              const pct = data.totalQuotes > 0 ? Math.round((value / data.totalQuotes) * 100) : 0;
              return (
                <li key={s.key}>
                  <Link
                    href={`/quotes?status=${s.key === "pending" ? "sent" : s.key}`}
                    aria-label={`${s.label}: ${value} of ${data.totalQuotes} quotes, ${pct} percent`}
                    className="block rounded-xl border border-border bg-background/40 p-2.5 transition-all hover:border-brand/40 hover:bg-brand/5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="flex-1 text-[11px] font-body text-muted-foreground">
                        {s.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium font-body",
                        )}
                        style={{
                          backgroundColor: `${s.color}1a`,
                          color: s.color,
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 font-heading text-lg font-semibold text-foreground">
                      {value}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
