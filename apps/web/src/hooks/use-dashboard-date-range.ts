"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The dashboard's date range, remembered between visits.
 *
 * It used to live in component state only, so every navigation back to
 * /dashboard threw the selection away and reset to month-to-date — which on the
 * 1st of a month is a single day, making the whole page look broken.
 *
 * **Whatever the user selects is what they get back, until they select
 * something else.** The range is therefore always stored as two absolute dates,
 * including when it came from a relative shortcut like "Last 7 days" or the 1W
 * tab: the shortcut is a way of *entering* a range, not a standing instruction
 * to re-derive one. An earlier version stored presets as presets and recomputed
 * them against today, which meant a range the user had explicitly chosen moved
 * on its own between visits.
 *
 * `preset` is carried alongside purely so the matching tab can be highlighted.
 * It never affects which dates are used — if it disagrees with `from`/`to`, the
 * dates win.
 */

export type DashboardRangePreset = "1D" | "1W" | "1M" | "6M" | "1Y" | "ALL";

export interface StoredDateRange {
  /** Authoritative. A `yyyy-MM-dd` day, inclusive. */
  from: string;
  /** Authoritative. A `yyyy-MM-dd` day, inclusive. */
  to: string;
  granularity?: "day" | "week" | "month";
  /** Cosmetic only: which shortcut tab to light up. */
  preset?: DashboardRangePreset | null;
}

const STORAGE_KEY = "dashboard-date-range";
const PRESETS: DashboardRangePreset[] = ["1D", "1W", "1M", "6M", "1Y", "ALL"];
const GRANULARITIES = ["day", "week", "month"] as const;

const isDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function parse(raw: string): StoredDateRange | null {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  // A range is only usable with both ends present and well-formed. Entries
  // written by the previous preset-only format have no dates and are dropped
  // here, which costs the user one re-selection rather than resurrecting the
  // recompute-against-today behaviour this hook exists to prevent.
  if (!isDate(v.from) || !isDate(v.to) || v.from > v.to) return null;

  const preset =
    typeof v.preset === "string" &&
    PRESETS.includes(v.preset as DashboardRangePreset)
      ? (v.preset as DashboardRangePreset)
      : null;

  return {
    from: v.from,
    to: v.to,
    granularity: GRANULARITIES.find((g) => g === v.granularity),
    preset,
  };
}

export function useDashboardDateRange() {
  const [stored, setStored] = useState<StoredDateRange | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStored(parse(raw));
    } catch {
      /* a malformed or unreadable entry just means "no saved range" */
    } finally {
      setHydrated(true);
    }
  }, []);

  const save = useCallback((next: StoredDateRange | null) => {
    setStored(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { stored, hydrated, save };
}
