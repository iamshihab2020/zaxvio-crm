/**
 * Fixed-point money arithmetic for the costing rollup.
 *
 * Every `numeric` column in this codebase crosses the wire as a string, and the
 * temptation is to `Number()` them, add, and `toFixed(2)` at the end. That is
 * how `0.1 + 0.2` gets into a margin: the quotes audit already found a subtotal
 * off by a cent from the line items that produced it (QUO-08), and a margin is a
 * *difference* of two sums, so float error there is doubled and lands on the
 * number a contractor uses to price their work.
 *
 * Cents as integers, one conversion in and one out.
 */

/** Parse a money string to integer cents. Returns null for null/blank/NaN. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Integer cents back to the `"0.00"` shape every numeric column uses. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Sum, skipping unknowns. The *count* of skips is what the caller reports. */
export function sumCents(values: Array<number | null>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/*
 * `laborCents(hours, rate)` used to live here and is deliberately gone rather
 * than kept "just in case". It could only ever express **one** rate for a whole
 * job, which is precisely the limitation time tracking removed: labour is now
 * summed per entry, each at its own snapshotted rate, inside the costing lateral.
 * Leaving it exported would have offered a second answer to "what did this job's
 * labour cost" — the same reason `getOutputs` was deleted rather than retained
 * once `outputsFor` existed.
 */

/**
 * `margin / revenue` as a 0–1 fraction.
 *
 * Null when revenue is zero: a percentage of nothing is undefined, not 0%.
 * Returning 0 would file a job that cost $300 and billed nothing next to one
 * that broke even exactly, which are not the same situation.
 */
export function marginPct(marginCents: number, revenueCents: number): number | null {
  if (revenueCents === 0) return null;
  return marginCents / revenueCents;
}
