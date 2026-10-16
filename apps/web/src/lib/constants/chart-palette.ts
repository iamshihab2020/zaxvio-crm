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

/** Index 0 is the least overdue. */
export const OVERDUE_COLORS = [
  tokenColor("overdue-1"),
  tokenColor("overdue-2"),
  tokenColor("overdue-3"),
  tokenColor("overdue-4"),
] as const;
