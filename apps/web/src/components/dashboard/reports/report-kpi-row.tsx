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
}

interface ReportKpiRowProps {
  kpis: ReportKpi[];
}

function computeTrend(current: number, previous: number) {
  if (previous === 0) {
    return current > 0
      ? { pct: 100, direction: "up" as const }
      : { pct: 0, direction: "neutral" as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { pct: 0, direction: "neutral" as const };
  return {
    pct: Math.abs(pct),
    direction: pct > 0 ? ("up" as const) : ("down" as const),
  };
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
}: ReportKpi) {
  const trend =
    currentValue !== undefined && previousValue !== undefined
      ? computeTrend(currentValue, previousValue)
      : null;

  const trendIsPositive = trend
    ? trendInverted
      ? trend.direction === "down"
      : trend.direction === "up"
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-light">
          <Icon className="h-3.5 w-3.5 text-brand" />
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
        {trend && trend.direction !== "neutral" && (
          <div className="mb-0.5 flex items-center gap-0.5">
            {trend.direction === "up" ? (
              <IconTrendingUp
                className={cn(
                  "h-3 w-3",
                  trendIsPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              />
            ) : (
              <IconTrendingDown
                className={cn(
                  "h-3 w-3",
                  trendIsPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              />
            )}
            <span
              className={cn(
                "text-xs font-medium font-body",
                trendIsPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {trend.pct}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
