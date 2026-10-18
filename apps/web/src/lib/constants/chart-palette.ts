/**
 * Data colours for charts and inline `style` (SVG fills, legend dots).
 *
 * Every value is a CSS variable from globals.css, so it follows the theme. This
 * module only decides WHICH token a datum gets, and each export does one job:
 *
 * - `categoricalColor` — identity. Fixed order, never cycled: past the fifth
 *   slot a bucket folds into `OTHER_COLOR` instead of reusing a hue.
 * - `STATUS_COLORS` — reserved good / warning / critical meaning. Always shown
 *   beside a label, never as a series colour.
 * - `OVERDUE_COLORS` — one red, darker the older the debt (ordinal).
 * - `BRAND_SERIES` / `rampColor` / `STATE_COLORS` — the brand ramp, for
 *   one-series charts and for records' states (/reports).
 *
 * The values themselves were checked with the dataviz validator in both themes
 * (see the notes beside them in globals.css). Do not add a hex here: a colour
 * that is not a token is a colour nobody validated.
 */

/** `hsl(var(--name))`, optionally at an alpha. */
export function tokenColor(name: string, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(--${name}))`
    : `hsl(var(--${name}) / ${alpha})`;
}

const CATEGORICAL = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

/** How many buckets can carry their own hue before the rest fold into "Other". */
export const MAX_CATEGORIES = CATEGORICAL.length;

/** Neutral, so a folded "Other" never reads as one more category. */
export const OTHER_COLOR = tokenColor("muted-foreground");

/** The hue for slot `index`, or the neutral once the slots run out. */
export function categoricalColor(index: number): string {
  const token = CATEGORICAL[index];
  return token ? tokenColor(token) : OTHER_COLOR;
}

export const STATUS_COLORS = {
  good: tokenColor("status-good"),
  warning: tokenColor("status-warning"),
  critical: tokenColor("status-critical"),
} as const;

/** A chart with one series: the brand, in both themes. */
export const BRAND_SERIES = tokenColor("chart-1");

const RAMP = [
  "chart-ramp-1",
  "chart-ramp-2",
  "chart-ramp-3",
  "chart-ramp-4",
  "chart-ramp-5",
] as const;

export type RampStep = 1 | 2 | 3 | 4 | 5;

/**
 * Deep Sea Blue from quiet (1) to strong (5). Step 3 is `BRAND_SERIES`.
 *
 * A ramp, not a categorical palette: neighbouring steps are about ΔE 10 apart,
 * which reads as "more" and "less" but not as two different things. Charts that
 * put parts side by side choose steps two apart where they touch, and always
 * name every part in text beside the shade.
 */
export function rampColor(step: RampStep): string {
  return tokenColor(RAMP[step - 1]);
}

/**
 * What a record's state means, as a colour. Work moving forward climbs the
 * ramp, darker (brighter in dark mode) the further along it is. Anything that
 * dropped out is the warm neutral, and only money that is late is red.
 */
export const STATE_COLORS = {
  /** Draft, scheduled: not under way yet. */
  waiting: rampColor(1),
  /** Sent, in progress: out with the customer or on site. */
  moving: rampColor(3),
  /** Partially paid. */
  partway: rampColor(4),
  /** Completed, accepted, paid. */
  done: rampColor(5),
  /** Cancelled, declined, expired, void, inactive. */
  dropped: tokenColor("chart-neutral"),
  /** Overdue. */
  late: STATUS_COLORS.critical,
} as const;

/** Index 0 is the least overdue. */
export const OVERDUE_COLORS = [
  tokenColor("overdue-1"),
  tokenColor("overdue-2"),
  tokenColor("overdue-3"),
  tokenColor("overdue-4"),
] as const;
