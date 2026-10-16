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

/*
 * There is no per-card accent. The pills used to take four: booking-teal on
 * "Active Customers" and event-indigo on "Quote Conversion" sat beside Week
 * Ahead, where teal means a booking and indigo an event, and "Outstanding" (money
 * owed) was green, which reads as good news. The icon is a decorative glyph next
 * to the label, so it is Safety Orange on every card, and the blurred hover glow
 * that existed to carry those accents is gone with them.
 */

export function KpiPill({
  label,
  value,
  icon: Icon,
  currentValue,
  previousValue,
  comparisonLabel = "vs last period",
  trendInverted = false,
  href,
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
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all",
        href && "cursor-pointer hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg",
      )}
    >
      {/* Row 1 — icon and the chip. The label moves BELOW the value: a KPI card
          is read number-first, and putting the label above it makes the eye
          parse a caption before the thing it captions. */}
      <div className="relative flex items-start justify-between gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
            <Icon className="h-[18px] w-[18px] text-brand" aria-hidden />
          </div>
        ) : (
          <span />
        )}

        {trend.kind === "pct" ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
              isPositive
                ? "bg-status-good/10 text-status-good-ink"
                : "bg-status-critical/10 text-status-critical-ink",
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
          <span className="inline-flex shrink-0 items-center rounded-full bg-status-good/10 px-2 py-0.5 text-[11px] font-medium font-body text-status-good-ink">
            New
          </span>
        ) : windowLabel ? (
          <WidgetWindowBadge label={windowLabel} />
        ) : null}
      </div>

      {/* Row 2 — the number, big and alone. */}
      <div className="relative mt-5">
        <span className="tnum font-heading text-[2rem] font-bold leading-none tracking-tight text-foreground">
          {value}
        </span>
      </div>

      {/* Row 3 — what the number is, then the detail. Always rendered, so the
          three cards keep equal height even when one has nothing to add. */}
      <div className="relative mt-2 flex min-h-5 flex-wrap items-baseline gap-x-1.5">
        <span className="text-sm font-body font-medium text-foreground">
          {label}
        </span>
        {supporting && (
          <span
            className={cn(
              "truncate text-[11px] font-body",
              footnoteTone === "danger"
                ? "font-medium text-status-critical-ink"
                : "text-muted-foreground",
            )}
          >
            {supporting}
          </span>
        )}
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
