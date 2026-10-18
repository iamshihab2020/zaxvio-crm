"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import {
  DUR,
  EASE_OUT_CSS,
  LIST_STAGGER_MAX,
  LIST_STAGGER_STEP,
  prefersReducedMotion,
  staggerChildren,
} from "@/lib/motion";

/** The same isomorphic pattern `use-route-arrival.ts` uses. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * What identifies "this content". `null`, `undefined` and `false` mean "not
 * ready" (still loading): nothing animates, and the first real key after that
 * counts as a change.
 */
export type StaggerKey = string | number | boolean | null | undefined;

export interface UseStaggerOptions {
  /**
   * Also animate on the first render with a real key. Off by default so a full
   * page load never animates; turn it on only for a component that mounts after
   * the page is already up (a tab panel, a drawer, content behind a client-side
   * route), where there is no server-rendered copy to flash.
   */
  onMount?: boolean;
  /** Delay between children in ms. Default 20. */
  step?: number;
  /** Steps before the remaining children share the last delay. Default 12. */
  max?: number;
  /** Starting offset in px. Default 6. */
  rise?: number;
}

/**
 * Arrives the direct children of `ref.current` one after another when `key`
 * changes: a page change, a filter change, data replacing a skeleton. For
 * tables, lists and grids, where a whole block fading in reads as a flash and a
 * sequence reads as the content being laid out.
 *
 * ```tsx
 * const bodyRef = useRef<HTMLTableSectionElement>(null);
 * // null while loading, a stable string once the rows for this view exist:
 * useStagger(bodyRef, isLoading ? null : `${page}:${status}:${search}`);
 * return <tbody ref={bodyRef}>{rows}</tbody>;
 * ```
 *
 * - **Key design is the whole API.** Animate when the *rows* change, not when
 *   the inputs change: include everything that selects different rows, and use
 *   `null` while they are loading. A key that changes on every render, or on a
 *   background refetch that returns the same rows, replays the animation for no
 *   reason; use the page, the filter and the search, not the data array.
 * - **After mount only**, unless `options.onMount`. The first render, and
 *   React's development double-invoke, never animate by default.
 * - **Each child:** opacity 0 to 1 and `translateY(6px)` to 0 over
 *   `--dur-state`, 20ms after the one before it, 12 steps at most (the 13th
 *   child and later share the 12th's delay). Children below the fold and
 *   children with no box are skipped and take no step. `<tr>` works.
 * - **No fill left behind**, so nothing keeps a transform that would capture a
 *   `position: fixed` descendant. Each child holds its first frame through its
 *   delay only.
 * - **Reduced motion:** the container fades once, 120ms, with no travel and no
 *   stagger.
 * - **Empty containers** do nothing: an empty state arrives with
 *   `.motion-appear`, not with this.
 * - **A key change mid-animation** cancels the running one first; the rows it
 *   was moving are being replaced.
 *
 * Returns nothing. The ref's element must stay mounted across the key change,
 * or the hook has nothing to animate (it quietly does nothing, never throws).
 */
export function useStagger<T extends HTMLElement>(
  ref: RefObject<T | null>,
  key: StaggerKey,
  options?: UseStaggerOptions,
): void {
  const running = useRef<Animation[]>([]);
  const previousKey = useRef<StaggerKey>(key);
  const mounted = useRef(false);

  // Options are read through a ref so an inline `{ step: 30 }` (a new object on
  // every render) cannot re-run the effect below and cancel an animation that
  // is halfway through. Declared first so it is current when that effect runs.
  const optionsRef = useRef(options);
  useIsoLayoutEffect(() => {
    optionsRef.current = options;
  });

  useIsoLayoutEffect(() => {
    const isMount = !mounted.current;
    mounted.current = true;

    const changed = previousKey.current !== key;
    previousKey.current = key;

    const opts = optionsRef.current;
    if (isMount ? !opts?.onMount : !changed) return;
    if (key == null || key === false) return;

    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (el.children.length === 0) return;

    for (const animation of running.current) animation.cancel();
    running.current = [];

    if (prefersReducedMotion()) {
      running.current = [
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DUR.feedback,
          easing: EASE_OUT_CSS,
        }),
      ];
      return;
    }

    running.current = staggerChildren(el, {
      rise: opts?.rise ?? 6,
      duration: DUR.state,
      step: opts?.step ?? LIST_STAGGER_STEP,
      max: opts?.max ?? LIST_STAGGER_MAX,
    });
  }, [key, ref]);

  // Unmount (and React's development unmount-remount). Resetting `mounted`
  // makes the simulated remount a mount again, so `onMount` plays in
  // development the way it does in production instead of being swallowed.
  useEffect(
    () => () => {
      for (const animation of running.current) animation.cancel();
      running.current = [];
      mounted.current = false;
    },
    [],
  );
}
