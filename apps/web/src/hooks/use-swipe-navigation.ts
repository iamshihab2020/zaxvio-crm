"use client";

import { useEffect, useRef, type RefObject } from "react";

/** How far a finger has to travel sideways, in px, before it counts. */
const MIN_DISTANCE = 56;
/** A swipe is a flick. A gesture longer than this was something else. */
const MAX_DURATION_MS = 600;
/**
 * react-big-calendar starts a drag or a slot selection after a 250ms press
 * (`longPressThreshold`). A finger that held still that long before moving
 * belongs to the calendar, so the swipe ignores it.
 */
const LONG_PRESS_MS = 250;

interface SwipeNavigationOptions {
  onPrev: () => void;
  onNext: () => void;
  enabled?: boolean;
}

/**
 * Sideways swipes on `ref` step back and forward, the way a phone calendar
 * turns its pages. Touch only: a mouse drag on the calendar still selects slots
 * and moves events. The listeners are passive and never call `preventDefault`,
 * so vertical scrolling is untouched. A gesture counts only when it is mostly
 * sideways, quick, and started moving at once.
 *
 * `ref` must point at an element that stays mounted for as long as `enabled`
 * does; the listeners are attached once.
 */
export function useSwipeNavigation(
  ref: RefObject<HTMLElement>,
  { onPrev, onNext, enabled = true }: SwipeNavigationOptions,
) {
  // The latest callbacks, so a re-render does not re-attach the listeners.
  const handlers = useRef({ onPrev, onNext });
  useEffect(() => {
    handlers.current = { onPrev, onNext };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let start: { x: number; y: number; t: number } | null = null;
    let movedAt: number | null = null;

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      const touch = e.touches[0];
      start = { x: touch.clientX, y: touch.clientY, t: e.timeStamp };
      movedAt = null;
    }

    function onMove(e: TouchEvent) {
      if (!start || movedAt !== null) return;
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - start.x) + Math.abs(touch.clientY - start.y) > 10) {
        movedAt = e.timeStamp;
      }
    }

    function onEnd(e: TouchEvent) {
      const s = start;
      start = null;
      if (!s || movedAt === null) return;
      if (movedAt - s.t >= LONG_PRESS_MS || e.timeStamp - s.t > MAX_DURATION_MS) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) handlers.current.onNext();
      else handlers.current.onPrev();
    }

    function onCancel() {
      start = null;
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [ref, enabled]);
}
