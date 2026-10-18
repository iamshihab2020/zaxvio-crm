import { STATE_COLORS, rampColor } from "@/lib/constants/chart-palette";

/**
 * Which shade of the brand each record state gets on /reports, and in what
 * order the parts of a ring are drawn. The fills and the legend are shared with
 * the dashboard (`components/dashboard/reusable/chart-fills.tsx`).
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
