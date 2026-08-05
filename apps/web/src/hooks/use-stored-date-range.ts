"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A date range picked on a dashboard page, remembered between visits.
 *
 * It used to live in component state only, so every navigation back threw the
 * selection away and reset to the server default — which for month-to-date on
 * the 1st of a month is a single day, making the whole page look broken.
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
 * dates win. Only /dashboard has shortcut tabs; /reports stores no preset and
 * simply gets `null` back.
 *
 * One hook, one storage key per page. The key is what separates /dashboard's
 * range from /reports' — they are the same control with the same expectation,
 * but they are not the same selection, and sharing a key would make changing
 * one silently change the other.
 */

export type RangePreset = "1D" | "1W" | "1M" | "6M" | "1Y" | "ALL";

export interface StoredDateRange {
  /** Authoritative. A `yyyy-MM-dd` day, inclusive. */
  from: string;
  /** Authoritative. A `yyyy-MM-dd` day, inclusive. */
  to: string;
  granularity?: "day" | "week" | "month";
  /** Cosmetic only: which shortcut tab to light up. */
  preset?: RangePreset | null;
}

export const DATE_RANGE_KEYS = {
  dashboard: "dashboard-date-range",
  reports: "reports-date-range",
} as const;

const PRESETS: RangePreset[] = ["1D", "1W", "1M", "6M", "1Y", "ALL"];
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
    typeof v.preset === "string" && PRESETS.includes(v.preset as RangePreset)
      ? (v.preset as RangePreset)
      : null;

  return {
    from: v.from,
    to: v.to,
    granularity: GRANULARITIES.find((g) => g === v.granularity),
    preset,
  };
}

export function useStoredDateRange(storageKey: string) {
  const [stored, setStored] = useState<StoredDateRange | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Deliberately an effect rather than a lazy `useState` initialiser: the
  // server renders with no stored range, so reading localStorage during the
  // first render would produce markup React then has to discard as a hydration
  // mismatch. The cost is one extra fetch on a visit with a saved range.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setStored(parse(raw));
    } catch {
      /* a malformed or unreadable entry just means "no saved range" */
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  const save = useCallback(
    (next: StoredDateRange | null) => {
      setStored(next);
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return { stored, hydrated, save };
}
