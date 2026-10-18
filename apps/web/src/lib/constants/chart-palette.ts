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
 * - `BRAND_SERIES` / `rampColor` / `STATE_COLORS` / `kindColor` /
 *   `pipelineStageColors` — the brand ramp, for one-series charts, for records'
 *   states, for the schedule's kinds and for a pipeline's stages (/dashboard
 *   and /reports).
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
export function rampColor(step: RampStep, alpha?: number): string {
  return tokenColor(RAMP[step - 1], alpha);
}

/** The warm stone: what dropped out, and a folded "Other". */
export const NEUTRAL_COLOR = tokenColor("chart-neutral");

const STATE_TOKENS = {
  /** Draft, scheduled: not under way yet. */
  waiting: RAMP[0],
  /** Sent, pending, in progress: out with the customer or on site. */
  moving: RAMP[2],
  /** Partially paid. */
  partway: RAMP[3],
  /** Completed, accepted, paid. */
  done: RAMP[4],
  /** Cancelled, declined, expired, void, inactive. */
  dropped: "chart-neutral",
  /** Overdue. */
  late: "status-critical",
} as const;

export type ChartState = keyof typeof STATE_TOKENS;

/**
 * What a record's state means, as a colour. Work moving forward climbs the
 * ramp, darker (brighter in dark mode) the further along it is. Anything that
 * dropped out is the warm neutral, and only money that is late is red. With an
 * alpha for a tint behind ink (a % chip), the same hue as the mark beside it.
 */
export function stateColor(state: ChartState, alpha?: number): string {
  return tokenColor(STATE_TOKENS[state], alpha);
}

export const STATE_COLORS = {
  waiting: stateColor("waiting"),
  moving: stateColor("moving"),
  partway: stateColor("partway"),
  done: stateColor("done"),
  dropped: stateColor("dropped"),
  late: stateColor("late"),
} as const satisfies Record<ChartState, string>;

const KIND_TOKENS = {
  job: RAMP[2],
  booking: RAMP[4],
  event: RAMP[0],
} as const;

export type ScheduleKind = keyof typeof KIND_TOKENS;

/**
 * The dashboard's scheduled work by kind (Up next, its hover card and Week
 * Ahead). Identity, so fixed: a job is the brand, a booking the strong end (a
 * request waiting on you), an event the quiet end (your own time, not a
 * customer's). Jobs sit between the other two in Week Ahead's stack, so every
 * touching pair is two steps apart. The Calendar still draws bookings teal and
 * events violet (`--series-booking`, `--series-event`).
 */
export function kindColor(kind: ScheduleKind, alpha?: number): string {
  return tokenColor(KIND_TOKENS[kind], alpha);
}

/** Steps for a pipeline with this many forward stages; both ends always used. */
const STAGE_STEPS: Record<number, readonly RampStep[]> = {
  1: [3],
  2: [1, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

/**
 * One colour per stage, in board order. A pipeline is a sequence, so its stages
 * climb the ramp the way the work does, and a stage named `cancelled` is the
 * stone. The stored stage colour is the user's pick for the board's columns and
 * is not used here: it is a preset name, and several presets are not blue.
 *
 * Three forward stages (the default pipeline) get steps 1, 3 and 5, the same
 * as Jobs by Status on /reports. Past five, stages are mixed between the two
 * ends rather than repeating a step.
 */
export function pipelineStageColors(stageNames: readonly string[]): string[] {
  const forwardCount = stageNames.filter((name) => name !== "cancelled").length;
  const steps = STAGE_STEPS[forwardCount];
  let index = 0;
  return stageNames.map((name) => {
    if (name === "cancelled") return NEUTRAL_COLOR;
    const position = index++;
    const step = steps?.[position];
    if (step) return rampColor(step);
    const strong = Math.round((position / Math.max(forwardCount - 1, 1)) * 100);
    return `color-mix(in oklch, ${rampColor(5)} ${strong}%, ${rampColor(1)})`;
  });
}

/**
 * The order to draw a pipeline's stages round a ring, as indexes into
 * `stageNames`. Up to three forward stages, board order already puts every
 * touching pair two steps apart. From four, neighbouring stages are
 * neighbouring steps (ΔE 8 to 10), so the ring takes every other stage and then
 * the rest: 1-4-2-5 for four, 1-3-5-2-4 for five, each touching pair two steps
 * apart (validated, both themes). Cancelled closes the ring. The legend beside
 * it keeps board order.
 */
export function pipelineRingOrder(stageNames: readonly string[]): number[] {
  const forward: number[] = [];
  const dropped: number[] = [];
  stageNames.forEach((name, i) => (name === "cancelled" ? dropped : forward).push(i));
  if (forward.length <= 3) return [...forward, ...dropped];
  const even = forward.filter((_, i) => i % 2 === 0);
  const odd = forward.filter((_, i) => i % 2 === 1);
  return [...even, ...odd, ...dropped];
}

/**
 * A bar drawn as a `div` (meters, aging rows): 65% at its base, full colour at
 * its end, the same shade an SVG bar gets from `barFill`. The bars scale on
 * `transform`, so the shade scales with them.
 */
export function barBackground(color: string): string {
  return `linear-gradient(to right, color-mix(in srgb, ${color} 65%, transparent), ${color})`;
}

/** Index 0 is the least overdue. */
export const OVERDUE_COLORS = [
  tokenColor("overdue-1"),
  tokenColor("overdue-2"),
  tokenColor("overdue-3"),
  tokenColor("overdue-4"),
] as const;

/**
 * Invoice aging, in bucket order (current, 1–30, 31–60, 61–90, 90+), for the
 * dashboard widget and the /reports chart alike, so the same buckets read the
 * same on both pages. Money not yet due is the brand; overdue is one red,
 * darker (brighter in dark mode) the older it is, and the only red on either
 * page. Current was status green until 2026-10-19: a brand bucket read as the
 * first of the overdue ones while the brand was orange, which a blue cannot.
 */
export const AGING_COLORS = [BRAND_SERIES, ...OVERDUE_COLORS] as const;
