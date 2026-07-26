"use client";

import Link from "next/link";
import type { TablerIcon } from "@tabler/icons-react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { DashboardSparklinePoint } from "@hvac-saas/types";
import { WidgetWindowBadge } from "./widget-window-badge";
import { cn } from "@/lib/utils";

interface KpiPillProps {
  label: string;
  value: string;
  icon?: TablerIcon;
  currentValue?: number;
  previousValue?: number;
  comparisonLabel?: string;
  trendInverted?: boolean;
  sparklineData?: DashboardSparklinePoint[];
  href?: string;
  accent?: "brand" | "indigo" | "emerald";
  /** Small line under the value, e.g. "3 unpaid invoices". */
  footnote?: string;
  footnoteTone?: "muted" | "danger";
  /** Set when this metric ignores the dashboard date picker. */
  windowLabel?: string;
}

type Trend =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "pct"; pct: number; direction: "up" | "down" };

/**
 * Growth from a zero baseline is not "+100%" — that is a real number meaning
 * "doubled", and printing it for 0 → 4 jobs is simply wrong. Report it as new.
 */
function computeTrend(current: number, previous: number): Trend {
  if (previous === 0) {
    return current === 0 ? { kind: "none" } : { kind: "new" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { kind: "none" };
  return { kind: "pct", pct: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

const ACCENT_STYLES: Record<
  NonNullable<KpiPillProps["accent"]>,
  { iconBg: string; iconColor: string; stroke: string; id: string }
> = {
  brand: {
    iconBg: "bg-brand/10",
    iconColor: "text-brand",
    stroke: "hsl(var(--brand))",
    id: "brand",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    stroke: "rgb(99 102 241)",
    id: "indigo",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    stroke: "rgb(16 185 129)",
    id: "emerald",
  },
};

export function KpiPill({
  label,
  value,
  icon: Icon,
  currentValue,
  previousValue,
  comparisonLabel = "vs last period",
  trendInverted = false,
  sparklineData,
  href,
  accent = "brand",
  footnote,
  footnoteTone = "muted",
  windowLabel,
}: KpiPillProps) {
  const trend =
    currentValue !== undefined && previousValue !== undefined
      ? computeTrend(currentValue, previousValue)
      : { kind: "none" as const };

  const isPositive =
    trend.kind === "pct"
      ? trendInverted
        ? trend.direction === "down"
        : trend.direction === "up"
      : true;

  const accentStyle = ACCENT_STYLES[accent];
  const gradientId = `kpi-spark-${accentStyle.id}-${label.replace(/\s+/g, "")}`;

  // Charts are decorative here; the number beside them carries the meaning.
  // Screen readers get one sentence rather than an unreadable SVG.
  const ariaLabel = [
    `${label}: ${value}`,
    trend.kind === "pct"
      ? `${trend.direction === "up" ? "up" : "down"} ${trend.pct} percent ${comparisonLabel}`
      : trend.kind === "new"
        ? `new ${comparisonLabel}`
        : null,
    footnote,
  ]
    .filter(Boolean)
    .join(", ");

  const content = (
    <div
      aria-label={ariaLabel}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all",
        href && "cursor-pointer hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg",
      )}
    >
      {/* Subtle brand glow on hover */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: accentStyle.stroke }}
        aria-hidden
      />

      {/* Sparkline background — decorative, described by the card's aria-label */}
      {sparklineData && sparklineData.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-60"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentStyle.stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accentStyle.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentStyle.stroke}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                accentStyle.iconBg,
              )}
            >
              <Icon className={cn("h-4 w-4", accentStyle.iconColor)} aria-hidden />
            </div>
          )}
          <span className="truncate text-xs font-body text-muted-foreground">
            {label}
          </span>
          {windowLabel && <WidgetWindowBadge label={windowLabel} />}
        </div>
        {trend.kind === "pct" && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
              isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
            )}
          >
            {trend.direction === "up" ? (
              <IconTrendingUp className="h-3 w-3" aria-hidden />
            ) : (
              <IconTrendingDown className="h-3 w-3" aria-hidden />
            )}
            {trend.pct}%
          </span>
        )}
        {trend.kind === "new" && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium font-body text-emerald-600 dark:text-emerald-400">
            New
          </span>
        )}
      </div>

      <div className="relative mt-4 flex items-baseline gap-2">
        <span className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {trend.kind !== "none" && (
          <span className="text-[11px] font-body text-muted-foreground">
            {comparisonLabel}
          </span>
        )}
      </div>

      {footnote && (
        <div
          className={cn(
            "relative mt-1 text-[11px] font-body",
            footnoteTone === "danger"
              ? "font-medium text-rose-600 dark:text-rose-400"
              : "text-muted-foreground",
          )}
        >
          {footnote}
        </div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  ) : (
    content
  );
}
