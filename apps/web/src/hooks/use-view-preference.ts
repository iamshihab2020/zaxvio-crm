"use client";

import { useState, useEffect, useCallback } from "react";

export type ViewMode = "sidebar" | "dialog" | "page";
export type EntityType = "quotes" | "jobs" | "invoices" | "bookings" | "events";

interface ViewPreference {
  mode: ViewMode;
  sidebarWidth: number;
}

const MIN_WIDTH = 400;
const MAX_WIDTH = 1200;

const VALID_MODES: ViewMode[] = ["sidebar", "dialog", "page"];

/** Default sidebar width = 40% of the viewport */
function getDefaultWidth(): number {
  if (typeof window === "undefined") return 520;
  return Math.round(window.innerWidth * 0.4);
}

function getStorageKey(entity: EntityType): string {
  return `zaxvio-${entity.replace(/s$/, "")}-detail-prefs`;
}

function loadPrefs(entity: EntityType): ViewPreference {
  try {
    const raw = localStorage.getItem(getStorageKey(entity));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: VALID_MODES.includes(parsed.mode) ? parsed.mode : "sidebar",
        sidebarWidth: Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, Number(parsed.sidebarWidth) || getDefaultWidth()),
        ),
      };
    }
  } catch {
    /* SSR or corrupt data */
  }
  return { mode: "sidebar", sidebarWidth: getDefaultWidth() };
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
    sidebarWidth: 520, // SSR fallback, replaced on mount
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
