"use client";

import type { TablerIcon } from "@tabler/icons-react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

interface ReportKpi {
  label: string;
  value: string;
  icon: TablerIcon;
  currentValue?: number;
  previousValue?: number;
  trendInverted?: boolean;
  suffix?: string;
  /** Clarifies what the number measures, e.g. "Booked value, not collected". */
  hint?: string;
}

interface ReportKpiRowProps {
  kpis: ReportKpi[];
}

type Trend =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "pct"; pct: number; direction: "up" | "down" };

/**
 * Growth from a zero baseline is not "+100%" — that is a real number meaning
 * "doubled", and printing it for £0 → £4,000 is simply wrong. Report it as new.
 * Same logic as `KpiPill` on the dashboard; the two had drifted apart.
 */
function computeTrend(current: number, previous: number): Trend {
  if (previous === 0) {
    return current === 0 ? { kind: "none" } : { kind: "new" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { kind: "none" };
  return { kind: "pct", pct: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

export function ReportKpiRow({ kpis }: ReportKpiRowProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        kpis.length <= 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {kpis.map((kpi, i) => (
        <Fade inView inViewOnce key={kpi.label} delay={i * 80}>
          <KpiItem {...kpi} />
        </Fade>
      ))}
    </div>
  );
}

function KpiItem({
  icon: Icon,
  label,
  value,
  currentValue,
  previousValue,
  trendInverted = false,
  suffix,
  hint,
}: ReportKpi) {
  const trend =
    currentValue !== undefined && previousValue !== undefined
      ? computeTrend(currentValue, previousValue)
      : null;

  const trendIsPositive =
    trend?.kind === "pct"
      ? trendInverted
        ? trend.direction === "down"
        : trend.direction === "up"
      : null;

  const toneClass = trendIsPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-light">
          <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
        </div>
        <span className="text-xs font-body text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="font-heading text-xl font-bold text-foreground">
          {value}
          {suffix && (
            <span className="ml-0.5 text-sm font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
        {trend?.kind === "new" && (
          <span className="mb-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium font-body text-muted-foreground">
            New
          </span>
        )}
        {trend?.kind === "pct" && (
          <div className="mb-0.5 flex items-center gap-0.5">
            {trend.direction === "up" ? (
              <IconTrendingUp className={cn("h-3 w-3", toneClass)} aria-hidden />
            ) : (
              <IconTrendingDown className={cn("h-3 w-3", toneClass)} aria-hidden />
            )}
            <span className={cn("text-xs font-medium font-body", toneClass)}>
              {trend.pct}%
            </span>
            <span className="sr-only">
              {trend.direction === "up" ? "up" : "down"} versus the previous period
            </span>
          </div>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-[11px] font-body leading-tight text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
