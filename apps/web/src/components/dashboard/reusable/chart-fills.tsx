"use client";

import { useId } from "react";

/**
 * The fills and the legend that /dashboard and /reports share, so a bar or a
 * ring is drawn the same way on both pages. Colours come from
 * `lib/constants/chart-palette.ts`; this file only decides how they are laid
 * down.
 */

/**
 * An SVG id for this chart's gradient. The old ones were fixed strings
 * ("fillRevCurrent", "revenueRangeFill"), so two copies of a chart on one page
 * would have shared, and clobbered, one definition. `useId`'s colons are
 * dropped because the id ends up inside `url(#…)`.
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
 * which is not a colour; give the tooltip the plain one.
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
 * never be the only way to tell two of them apart. On /reports it sits inside
 * the chart card's `aria-hidden` wrapper; screen readers get the card's data
 * table.
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
