"use client";

import Link from "next/link";
import type { TablerIcon } from "@tabler/icons-react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { WidgetWindowBadge } from "./widget-window-badge";
import { cn } from "@/lib/utils";

/**
 * One KPI card. The three on the dashboard read as a set, so every one of them
 * has exactly the same three rows:
 *
 *   [icon] Label ....................... [chip]
 *   VALUE
 *   supporting line
 *
 * They previously did not. The sparkline was only ever passed to "Jobs Today",
 * because it is the only metric with a series behind it — so one card had a
 * chart filling its lower half and the other two were empty. The chip slot was
 * worse: a trend badge rendered hard right, while `windowLabel` rendered inline
 * beside the label, so the same conceptual element sat in two different places
 * depending on which card you looked at. And `comparisonLabel` printed *beside*
 * the value while `footnote` printed *underneath* it, so the supporting text
 * changed position card to card and the numbers no longer shared a baseline.
 *
 * The sparkline is gone rather than faked onto the other two. The component's
 * own comment called it decorative, it pulled recharts into a card that shows
 * one number, and a flourish only one card in three can have is not a
 * flourish — it is an inconsistency.
 */
interface KpiPillProps {
  label: string;
  value: string;
  icon?: TablerIcon;
  currentValue?: number;
  previousValue?: number;
  comparisonLabel?: string;
  trendInverted?: boolean;
  href?: string;
  accent?: "brand" | "indigo" | "emerald";
  /** Supporting line under the value, e.g. "5 unpaid invoices". */
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
  { iconBg: string; iconColor: string; glow: string }
> = {
  brand: {
    iconBg: "bg-brand/10",
    iconColor: "text-brand",
    glow: "hsl(var(--brand))",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    glow: "rgb(99 102 241)",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    glow: "rgb(16 185 129)",
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

  /**
   * One supporting line for every card, whatever it is made of. The trend's
   * comparison ("vs yesterday") used to sit beside the value and the footnote
   * underneath it; joining them here means all three cards put their supporting
   * text in the same place and their numbers share a baseline.
   */
  const supporting = [
    trend.kind !== "none" ? comparisonLabel : null,
    footnote,
  ]
    .filter(Boolean)
    .join(" · ");

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
      {/* Subtle accent glow on hover */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: accentStyle.glow }}
        aria-hidden
      />

      {/* Row 1 — icon, label, and ONE chip slot, always hard right. */}
      <div className="relative flex items-center justify-between gap-3">
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
        </div>

        {trend.kind === "pct" ? (
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
        ) : trend.kind === "new" ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium font-body text-emerald-600 dark:text-emerald-400">
            New
          </span>
        ) : windowLabel ? (
          <WidgetWindowBadge label={windowLabel} />
        ) : null}
      </div>

      {/* Row 2 — the number, alone, so all three share a baseline. */}
      <div className="relative mt-4">
        <span className="tnum font-heading text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
      </div>

      {/* Row 3 — always rendered, so cards stay the same height when a card has
          nothing to say here. */}
      <div
        className={cn(
          "relative mt-1 min-h-4 truncate text-[11px] font-body",
          footnoteTone === "danger"
            ? "font-medium text-rose-600 dark:text-rose-400"
            : "text-muted-foreground",
        )}
      >
        {supporting}
      </div>
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
