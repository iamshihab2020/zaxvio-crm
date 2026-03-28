"use client";

import { useState, useEffect, useCallback } from "react";

export type ViewMode = "sidebar" | "dialog" | "page";
export type EntityType = "quotes" | "jobs" | "invoices" | "bookings";

interface ViewPreference {
  mode: ViewMode;
  sidebarWidth: number;
}

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;
const MAX_WIDTH = 800;

const VALID_MODES: ViewMode[] = ["sidebar", "dialog", "page"];

function getStorageKey(entity: EntityType): string {
  return `zaxvio-${entity.replace(/s$/, "")}-detail-prefs`;
}

// Special case: "quotes" → "zaxvio-quote-detail-prefs" (matches existing keys)
// "jobs" → "zaxvio-job-detail-prefs"
// "invoices" → "zaxvio-invoice-detail-prefs"

function loadPrefs(entity: EntityType): ViewPreference {
  try {
    const raw = localStorage.getItem(getStorageKey(entity));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: VALID_MODES.includes(parsed.mode) ? parsed.mode : "sidebar",
        sidebarWidth: Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, Number(parsed.sidebarWidth) || DEFAULT_WIDTH),
        ),
      };
    }
  } catch {
    /* SSR or corrupt data */
  }
  return { mode: "sidebar", sidebarWidth: DEFAULT_WIDTH };
}

function savePrefs(entity: EntityType, prefs: ViewPreference) {
  try {
    localStorage.setItem(getStorageKey(entity), JSON.stringify(prefs));
  } catch {
    /* quota exceeded */
  }
}

export function useViewPreference(entity: EntityType) {
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<ViewPreference>({
    mode: "sidebar",
    sidebarWidth: DEFAULT_WIDTH,
  });

  useEffect(() => {
    setPrefs(loadPrefs(entity));
    setMounted(true);
  }, [entity]);

  const setMode = useCallback(
    (mode: ViewMode) => {
      setPrefs((prev) => {
        const next = { ...prev, mode };
        savePrefs(entity, next);
        return next;
      });
    },
    [entity],
  );

  const setSidebarWidth = useCallback(
    (sidebarWidth: number) => {
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, sidebarWidth));
      setPrefs((prev) => {
        const next = { ...prev, sidebarWidth: clamped };
        savePrefs(entity, next);
        return next;
      });
    },
    [entity],
  );

  return {
    mode: prefs.mode,
    sidebarWidth: prefs.sidebarWidth,
    mounted,
    setMode,
    setSidebarWidth,
  };
}
