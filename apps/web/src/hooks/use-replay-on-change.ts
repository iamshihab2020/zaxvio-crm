"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { replayMotion } from "@/lib/motion";

/** The same isomorphic pattern `use-stagger.ts` uses. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type ReplayValue = string | number | boolean | null | undefined;

/**
 * Plays a CSS motion class (`motion-pop`, `motion-highlight`, `motion-step-back`)
 * on `ref.current` when `value` changes, never on the first render.
 *
 * ```tsx
 * const pillRef = useRef<HTMLSpanElement>(null);
 * useReplayOnChange(pillRef, job.status, "motion-pop", job.id);
 * <span ref={pillRef} className="inline-flex"><Badge>{label}</Badge></span>
 * ```
 *
 * - **A change, not a value.** The reader is told "this just changed", so the
 *   first render and any arrival of the value (`null` or `undefined` before it)
 *   stay quiet: a status that loads in is not a status that changed.
 * - **`scope`** names which record the value belongs to. A different scope
 *   (another job opened in the same sheet) resets the baseline without playing,
 *   or every record with a different status than the last would pop on open.
 * - **Only a real new value plays.** `null`, `undefined` and `false` mean the
 *   thing went away (a closed panel), so there is nothing to draw attention to.
 * - **Before paint.** A layout effect, so a pill that mounts in the same commit
 *   as its change (a badge that appears) never shows one frame at rest first.
 * - **No remount.** It restarts the class on the element that is there, via
 *   `replayMotion`, so a `key` is not needed and what the user typed survives.
 *   Reduced motion is the class's own override.
 */
export function useReplayOnChange<T extends HTMLElement>(
  ref: RefObject<T | null>,
  value: ReplayValue,
  className: string,
  scope?: string | number | null,
): void {
  const previous = useRef<{ value: ReplayValue; scope: string | number | null | undefined }>({
    value,
    scope,
  });

  useIsoLayoutEffect(() => {
    const was = previous.current;
    previous.current = { value, scope };

    if (was.scope !== scope) return;
    if (was.value === value) return;
    if (was.value == null) return;
    if (value == null || value === false) return;

    const el = ref.current;
    if (el) replayMotion(el, className);
  }, [value, scope, className, ref]);
}
