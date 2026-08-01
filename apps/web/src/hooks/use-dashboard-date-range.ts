"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The dashboard's date range, remembered between visits.
 *
 * It used to live in component state only, so every navigation back to
 * /dashboard threw the selection away and reset to month-to-date — which on the
 * 1st of a month is a single day, making the whole page look broken.
 *
 * A *preset* is stored as the preset, not as the dates it resolved to. Storing
 * "2026-07-25 → 2026-08-01" for "last 7 days" would mean opening the dashboard
 * next week on a stale window that still claims to be the last 7 days. Presets
 * are recomputed from today on every load; only a hand-picked custom range is
 * stored as absolute dates.
 */

export type DashboardRangePreset = "1D" | "1W" | "1M" | "6M" | "1Y" | "ALL";

export interface StoredDateRange {
  /** Set when the range came from a preset tab or a matching picker preset. */
  preset: DashboardRangePreset | null;
  /** Only meaningful when `preset` is null. */
  from?: string;
  to?: string;
  granularity?: "day" | "week" | "month";
}

const STORAGE_KEY = "dashboard-date-range";
const PRESETS: DashboardRangePreset[] = ["1D", "1W", "1M", "6M", "1Y", "ALL"];
const GRANULARITIES = ["day", "week", "month"] as const;

function parse(raw: string): StoredDateRange | null {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const preset =
    typeof v.preset === "string" && PRESETS.includes(v.preset as DashboardRangePreset)
      ? (v.preset as DashboardRangePreset)
      : null;
  if (preset) return { preset };

  // A custom range is only usable with both ends present and well-formed.
  const isDate = (s: unknown): s is string =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(v.from) || !isDate(v.to) || v.from > v.to) return null;

  const granularity = GRANULARITIES.find((g) => g === v.granularity);
  return { preset: null, from: v.from, to: v.to, granularity };
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
