/**
 * Deterministic randomness, calendar arithmetic and clock helpers for the demo
 * dataset. Pure: no I/O, no `Date.now()`. Everything that depends on "today"
 * takes it as an argument, so the generator's output is a function of its
 * inputs and nothing else.
 */

export interface Weighted<T> {
  value: T;
  weight: number;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A value from `min` to `max` in increments of `step` (both inclusive). */
  step(min: number, max: number, step: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly Weighted<T>[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32: a tiny, well-behaved 32-bit PRNG. Same seed, same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  const int = (min: number, max: number): number =>
    min + Math.floor(next() * (max - min + 1));

  const rng: Rng = {
    next,
    int,
    step(min, max, step) {
      const steps = Math.floor((max - min) / step + 1e-9);
      const value = min + int(0, steps) * step;
      // Kill float dust: 0.1 + 0.2 style artefacts would leak into money.
      return Math.round(value * 1000) / 1000;
    },
    chance(probability) {
      return next() < probability;
    },
    pick(items) {
      if (items.length === 0) throw new Error("pick() from an empty list");
      return items[int(0, items.length - 1)]!;
    },
    weighted(items) {
      const last = items[items.length - 1];
      if (!last) throw new Error("weighted() from an empty list");
      let total = 0;
      for (const item of items) total += item.weight;
      let roll = next() * total;
      for (const item of items) {
        roll -= item.weight;
        if (roll < 0) return item.value;
      }
      return last.value;
    },
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        const held = out[i]!;
        out[i] = out[j]!;
        out[j] = held;
      }
      return out;
    },
  };
  return rng;
}

/* ── money ─────────────────────────────────────────────────────────────────
   Same formula as `round2` in services/invoices/status.service.ts. It is
   restated here (rather than imported) only because this module is meant to be
   free of the database package; the writer uses the real one. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ── clock ───────────────────────────────────────────────────────────────── */

/** "08:30" -> 510. */
export function toMinutes(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.slice(0, 5).split(":");
  return Number(h) * 60 + Number(m);
}

/** 510 -> "08:30". Clamped to the day so a bad sum can never emit "25:10". */
export function toHhmm(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ── calendar ────────────────────────────────────────────────────────────────
   Pure arithmetic on a `YYYY-MM-DD` string. Built at noon UTC so a date never
   slips into its neighbour. */

export interface DemoCalendar {
  today: string;
  /** 0 = Sunday ... 6 = Saturday, for the day `offset` days from today. */
  weekday(offset: number): number;
  isWeekday(offset: number): boolean;
  isWeekend(offset: number): boolean;
  /** The closest weekday at or after `offset` (searching forward). */
  weekdayOnOrAfter(offset: number): number;
  /** The closest weekday at or before `offset` (searching backward). */
  weekdayOnOrBefore(offset: number): number;
  /** The next weekday strictly after `offset`. */
  nextWeekday(offset: number): number;
  /** "Mon 3 Nov" style label, for human-readable descriptions. */
  label(offset: number): string;
}

export function createCalendar(today: string): DemoCalendar {
  const parts = today.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;

  const at = (offset: number) => new Date(Date.UTC(y, m - 1, d + offset, 12));

  const weekday = (offset: number) => at(offset).getUTCDay();
  const isWeekend = (offset: number) => {
    const w = weekday(offset);
    return w === 0 || w === 6;
  };

  const cal: DemoCalendar = {
    today,
    weekday,
    isWeekday: (offset) => !isWeekend(offset),
    isWeekend,
    weekdayOnOrAfter(offset) {
      let o = offset;
      while (isWeekend(o)) o += 1;
      return o;
    },
    weekdayOnOrBefore(offset) {
      let o = offset;
      while (isWeekend(o)) o -= 1;
      return o;
    },
    nextWeekday(offset) {
      let o = offset + 1;
      while (isWeekend(o)) o += 1;
      return o;
    },
    label(offset) {
      return LABEL_FORMAT.format(at(offset));
    },
  };
  return cal;
}

const LABEL_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
