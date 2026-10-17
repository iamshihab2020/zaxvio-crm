"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";

export type ViewMode = "sidebar" | "dialog" | "page";
export type EntityType = "quotes" | "jobs" | "invoices" | "bookings" | "events";

interface ViewPreference {
  mode: ViewMode;
  sidebarWidth: number;
}

const MIN_WIDTH = 400;
const MAX_WIDTH = 1200;

const VALID_MODES: ViewMode[] = ["sidebar", "dialog", "page"];

function clampWidth(width: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
}

/**
 * Default sidebar width = 40% of the viewport, inside [MIN_WIDTH, MAX_WIDTH].
 * Unclamped, a 375px phone defaulted to 150px and a 768px tablet to 307px. The
 * floor is safe because a sheet only uses this width from `md` (768px) up,
 * where 400px always fits; below that `getSheetWidth` ignores it.
 */
function getDefaultWidth(): number {
  if (typeof window === "undefined") return 520;
  return clampWidth(Math.round(window.innerWidth * 0.4));
}

/**
 * Sizing for a right-hand sheet whose width the user can drag: the detail
 * sheets and the three create sheets. Below `md` it is the whole screen, since
 * a width picked on a desktop means nothing at 375px; from `md` it is the
 * preference, never wider than the window. The width travels as a CSS variable
 * rather than an inline `maxWidth` so the breakpoint stays in CSS and a stored
 * 1200px on a narrowed window can't overflow it.
 *
 * `sm:max-w-full` is not redundant: `SheetContent` carries `sm:max-w-lg`, and
 * tailwind-merge only replaces a class that has the same variant prefix.
 */
export function getSheetWidth(width: number): {
  className: string;
  style: CSSProperties;
} {
  return {
    className:
      "w-full max-w-full sm:max-w-full md:max-w-[min(var(--sheet-w),100vw)]",
    style: { "--sheet-w": `${width}px` } as CSSProperties,
  };
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
        sidebarWidth: clampWidth(
          Number(parsed.sidebarWidth) || getDefaultWidth(),
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
      const clamped = clampWidth(sidebarWidth);
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
