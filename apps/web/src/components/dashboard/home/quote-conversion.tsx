"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { IconFileDescription } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { tokenColor } from "@/lib/constants/chart-palette";
import type { DashboardQuoteSummary } from "@hvac-saas/types";
import { ChartTooltipBox } from "./chart-tooltip";
import { chartAnimation } from "./chart-motion";
import { WidgetHeader } from "./widget-header";

interface QuoteConversionProps {
  data: DashboardQuoteSummary;
}

// Status meaning, so status tokens. Each carries its token name rather than a
// colour string because the % chip needs the same hue at 10% for its tint.
const SEGMENT_CONFIG = [
  { key: "accepted" as const, label: "Accepted", token: "status-good" },
  { key: "declined" as const, label: "Declined", token: "status-critical" },
  { key: "pending" as const, label: "Pending", token: "status-warning" },
].map((s) => ({ ...s, color: tokenColor(s.token) }));

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; color: string } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <ChartTooltipBox>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {p.name}
        </span>
      </div>
      <div className="mt-0.5 text-sm">
        <span className="tnum font-heading font-semibold">{p.value}</span>{" "}
        {p.value === 1 ? "quote" : "quotes"}
      </div>
    </ChartTooltipBox>
  );
}

// One element for the life of the module, not `<FunnelTooltip />` inline in the
// chart. Recharts decides whether a pie's children changed by comparing their
// props one level deep, and a `content` element built on every render is never
// equal to the last one, which restarts the draw-in each time the card
// re-renders. A stable element keeps the animation for real data changes.
const FUNNEL_TOOLTIP = <FunnelTooltip />;

export function QuoteConversion({ data }: QuoteConversionProps) {
  // Memoised on purpose, now that the ring animates: Recharts restarts a
  // `Pie`'s draw-in when its `data` changes identity, and a fresh array on
  // every render would replay it on each refetch and widget toggle.
  const chartData = useMemo(
    () =>
      SEGMENT_CONFIG.map((s) => ({
        name: s.label,
        value: data[s.key],
        color: s.color,
      })).filter((d) => d.value > 0),
    [data],
  );
  const anim = chartAnimation();

  return (
    <Card data-widget="quoteFunnel" className="flex h-full flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Quote Funnel"
        action={
          <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
            <AnimatedNumber
              value={data.totalQuotes}
              format={String}
              className="font-mono"
            />{" "}
            {data.totalQuotes === 1 ? "quote" : "quotes"}
          </span>
        }
      />

      {data.totalQuotes === 0 ? (
        <div className="motion-appear mt-4 flex-1 rounded-md border border-dashed border-border bg-muted/10 p-4 text-center sm:p-6">
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
        /* Wraps rather than switching at a breakpoint. The donut is a fixed
           140px and the legend needs about 200px, and this card is anywhere
           from 280px (a phone, or half of the two-up grid) to 400px+ inside, so
           no viewport breakpoint says whether they fit side by side. Letting the
           legend wrap below the ring when it cannot sit beside it does. */
        <div className="mt-4 flex flex-1 flex-wrap items-center justify-center gap-5">
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
                  {...anim}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={FUNNEL_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tnum font-heading text-2xl font-bold tracking-tight text-foreground">
                <AnimatedNumber
                  value={data.conversionRate}
                  format={(n) => `${n}%`}
                />
              </span>
              <span className="text-[10px] font-body uppercase tracking-wide text-muted-foreground">
                conversion
              </span>
            </div>
          </div>

          {/* Legend with counts */}
          <ul className="grow basis-[12.5rem] space-y-2">
            {SEGMENT_CONFIG.map((s) => {
              const value = data[s.key];
              const pct = data.totalQuotes > 0 ? Math.round((value / data.totalQuotes) * 100) : 0;
              return (
                <li key={s.key}>
                  <Link
                    href={`/quotes?status=${s.key === "pending" ? "sent" : s.key}`}
                    aria-label={`${s.label}: ${value} of ${data.totalQuotes} quotes, ${pct} percent`}
                    className="block rounded-md border border-border bg-background/40 p-2.5 transition-colors hover:border-brand/40 hover:bg-brand/5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="flex-1 text-xs font-body text-muted-foreground">
                        {s.label}
                      </span>
                      {/* Ink on a tint of the status hue. The number used to be
                          printed in the hue itself, which was 1.6:1 for pending
                          and 2.1:1 for accepted; the dot beside the label
                          already carries the colour. */}
                      <span
                        className="tnum rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground"
                        style={{ backgroundColor: tokenColor(s.token, 0.14) }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-lg font-medium text-foreground">
                      <AnimatedNumber value={value} format={String} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
