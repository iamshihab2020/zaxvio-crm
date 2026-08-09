"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A drag-resizable side panel whose width is remembered.
 *
 * Follows the same shape as `use-detail-shell.ts`: a **live** width in state
 * while the pointer is down, written to storage exactly once on release. The
 * alternative — persisting on every move — writes to `localStorage` sixty times
 * a second and makes the drag stutter on the write.
 *
 * `mounted` exists because the stored width is not known during SSR. Rendering
 * the default first and swapping on mount avoids a hydration mismatch; callers
 * use it to suppress the open/close transition for that first frame, so the
 * panel does not visibly animate from the default to the saved width on load.
 */

interface Options {
  /** `localStorage` key. Namespaced by the caller. */
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  /** Absolute cap. Also clamped to a share of the viewport — see `resolveMax`. */
  maxWidth: number;
  /** Which edge the panel is anchored to; the handle goes on the other side. */
  side: "left" | "right";
}

export interface ResizablePanel {
  width: number;
  mounted: boolean;
  isResizing: boolean;
  /** Attach to the drag handle's `onPointerDown`. */
  startResize: (event: React.PointerEvent) => void;
  /** Attach to the handle's `onDoubleClick` — restores the default width. */
  reset: () => void;
}

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
}: Options): ResizablePanel {
  const [width, setWidth] = useState(defaultWidth);
  const [mounted, setMounted] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(defaultWidth);

  /**
   * Never let a panel take more than half the window.
   *
   * A width saved on a 27-inch monitor and restored on a laptop would otherwise
   * leave the canvas as a sliver — the stored value is re-clamped on every load
   * rather than trusted, because the viewport it was chosen on is gone.
   */
  const resolveMax = useCallback(() => {
    if (typeof window === "undefined") return maxWidth;
    return Math.min(maxWidth, Math.round(window.innerWidth * 0.5));
  }, [maxWidth]);

  const clamp = useCallback(
    (value: number) => Math.max(minWidth, Math.min(resolveMax(), value)),
    [minWidth, resolveMax],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw === null ? NaN : Number(raw);
      const next = Number.isFinite(parsed) ? clamp(parsed) : defaultWidth;
      widthRef.current = next;
      setWidth(next);
    } catch {
      /* private mode, or a value someone hand-edited */
    }
    setMounted(true);
  }, [storageKey, defaultWidth, clamp]);

  // Re-clamp when the window changes size, so a panel cannot end up wider than
  // the window it is now in.
  useEffect(() => {
    function onResize() {
      setWidth((current) => {
        const next = clamp(current);
        widthRef.current = next;
        return next;
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      setIsResizing(true);

      function onMove(moveEvent: PointerEvent) {
        const next = clamp(
          side === "right"
            ? window.innerWidth - moveEvent.clientX
            : moveEvent.clientX,
        );
        widthRef.current = next;
        setWidth(next);
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        // Held on <body> rather than the handle: once the pointer leaves the
        // 6px strip mid-drag, a cursor set on the handle reverts and the drag
        // looks like it has stopped even though it has not.
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsResizing(false);
        try {
          window.localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          /* quota, private mode */
        }
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      // A cancelled pointer (a browser gesture taking over) must clean up too,
      // or the whole document is left unselectable with a resize cursor.
      document.addEventListener("pointercancel", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [clamp, side, storageKey],
  );

  const reset = useCallback(() => {
    const next = clamp(defaultWidth);
    widthRef.current = next;
    setWidth(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      /* ignore */
    }
  }, [clamp, defaultWidth, storageKey]);

  return { width, mounted, isResizing, startResize, reset };
}
