"use client";

import { useId } from "react";
import { STATE_COLORS, rampColor } from "@/lib/constants/chart-palette";

/**
 * Which shade of the brand each record state gets on /reports, and in what
 * order the parts of a ring are drawn.
 *
 * Every chart here used to bring its own colours: green/amber/red job
 * statuses from the API, teal and orange bars, hex maps for quotes and
 * invoices, and the pipeline's stage preset names ("blue", "green") passed
 * straight to CSS, which drew them as the keywords #0000ff and #008000. The
 * user asked for the brand's shades instead (2026-10-19).
 *
 * A state the map has not met is neutral, never a guessed blue.
 */

export const UNKNOWN_FILL = STATE_COLORS.dropped;

export const JOB_STATUS_FILL: Record<string, string> = {
  scheduled: STATE_COLORS.waiting,
  in_progress: STATE_COLORS.moving,
  completed: STATE_COLORS.done,
  cancelled: STATE_COLORS.dropped,
};

/** Lifecycle order, for the ring and its legend alike. */
export const JOB_STATUS_ORDER = ["scheduled", "in_progress", "completed", "cancelled"];

export const QUOTE_STATUS_FILL: Record<string, string> = {
  draft: STATE_COLORS.waiting,
  sent: STATE_COLORS.moving,
  accepted: STATE_COLORS.done,
  declined: STATE_COLORS.dropped,
  expired: STATE_COLORS.dropped,
};

export const INVOICE_STATUS_FILL: Record<string, string> = {
  draft: STATE_COLORS.waiting,
  sent: STATE_COLORS.moving,
  partially_paid: STATE_COLORS.partway,
  paid: STATE_COLORS.done,
  overdue: STATE_COLORS.late,
  void: STATE_COLORS.dropped,
};

/** Lifecycle order, for the legend. */
export const INVOICE_STATUS_ORDER = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
];

/**
 * The ring's order is not the lifecycle's. Sent, partially paid and paid are
 * neighbouring ramp steps (ΔE 9.5 apart), too close to touch, so the ring puts
 * something different between each of them. Every touching pair here clears
 * ΔE 16 in both themes; the legend keeps the lifecycle order.
 */
export const INVOICE_RING_ORDER = [
  "sent",
  "draft",
  "partially_paid",
  "void",
  "paid",
  "overdue",
];

/**
 * Payment methods have no order, so each method keeps one step wherever it is
 * drawn, whatever its share this period: colour follows the method, not its
 * rank. The ring is drawn in this order so that touching slices sit at least
 * two steps apart.
 */
export const PAYMENT_METHOD_FILL: Record<string, string> = {
  credit_card: rampColor(3),
  cash: rampColor(1),
  check: rampColor(5),
  bank_transfer: rampColor(2),
  other: STATE_COLORS.dropped,
};

export const PAYMENT_METHOD_ORDER = [
  "credit_card",
  "cash",
  "check",
  "bank_transfer",
  "other",
];

/** `rows` in `order` by `key`; anything not in `order` goes last. */
export function sortByOrder<T>(
  rows: readonly T[],
  key: (row: T) => string,
  order: readonly string[],
): T[] {
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i === -1 ? order.length : i;
  };
  return [...rows].sort((a, b) => rank(key(a)) - rank(key(b)));
}

/**
 * An SVG id for this chart's gradient. The old ones were fixed strings
 * ("fillRevCurrent"), so two copies of a chart on one page would have shared,
 * and clobbered, one definition. `useId`'s colons are dropped because the id
 * ends up inside `url(#…)`.
 */
export function useFillId(): string {
  return `fill-${useId().replace(/:/g, "")}`;
}

/**
 * A bar's fill: the full colour at the value end, 65% at the baseline, so the
 * shade runs the way the bar grows. Called as a function, not rendered as a
 * component: Recharts only draws chart children it recognises as SVG, and it
 * would drop a component wrapping the same `<defs>`.
 *
 * A bar filled with `url(#…)` hands that string to the tooltip as its colour,
 * which is not a colour; pass the plain one as the tooltip's `color`.
 */
export function barFill(id: string, color: string, grows: "up" | "right") {
  return (
    <defs>
      <linearGradient
        id={id}
        x1="0"
        y1={grows === "up" ? "1" : "0"}
        x2={grows === "up" ? "0" : "1"}
        y2="0"
      >
        <stop offset="0%" stopColor={color} stopOpacity={0.65} />
        <stop offset="100%" stopColor={color} stopOpacity={1} />
      </linearGradient>
    </defs>
  );
}

/** An area's fill: the line's colour, fading out toward the axis. */
export function areaFill(id: string, color: string) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
        <stop offset="95%" stopColor={color} stopOpacity={0.03} />
      </linearGradient>
    </defs>
  );
}

/**
 * The same gradient for a bar drawn as a `div` (the pipeline and aging rows),
 * which scale on `transform`, so the shade scales with them.
 */
export function barBackground(color: string): string {
  return `linear-gradient(to right, color-mix(in srgb, ${color} 65%, transparent), ${color})`;
}

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  /** The part's figure, already formatted. */
  value: string;
}

/**
 * The legend under a ring, which is also its readout: every part's name and
 * figure in text. Several parts are shades of one blue, so the shade must
 * never be the only way to tell two of them apart. Sits inside the chart
 * card's `aria-hidden` wrapper; screen readers get the card's data table.
 */
export function ChartLegendList({ items }: { items: LegendEntry[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 font-body text-xs">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-medium tabular-nums text-foreground">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
