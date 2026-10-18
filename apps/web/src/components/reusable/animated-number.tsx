"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT, prefersReducedMotion } from "@/lib/motion";

/** The same isomorphic pattern `use-route-arrival.ts` uses. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface AnimatedNumberProps {
  /** The number to show. A change tweens from what is on screen to this. */
  value: number;
  /**
   * Turns a number into its text: `(n) => formatCurrency(n)`. Called with every
   * in-between value while tweening, so it must be cheap and must not throw.
   * An inline arrow is fine; it is read through a ref and never re-runs a tween.
   */
  format: (value: number) => string;
  className?: string;
  /**
   * Count up from 0 once, right after mounting. Off by default.
   *
   * The server-rendered text is already on screen when the page first loads,
   * and counting from 0 over it would flash the final number, drop it to zero
   * and climb. Turn it on only where the number mounts after the page is up
   * (a KPI behind a client-side route change, or one that appears when its
   * query resolves). The caller decides; this component cannot tell.
   */
  animateOnMount?: boolean;
  /** Tween length in ms. Default 600. */
  duration?: number;
}

/**
 * A figure that counts to its new value instead of replacing itself.
 *
 * Meant for KPIs and totals, where the reader is watching a number and a count
 * says "this changed, and by about this much" in a way a swap cannot. It is not
 * for tables of figures, where every cell moving at once is noise.
 *
 * ## How it stays out of React's way
 *
 * A tween is 36 writes in 600ms; routing them through state would re-render the
 * component 36 times. So the text is written straight into the DOM node. React
 * is given the initial text once, as a frozen string that never changes, which
 * means it never decides the node's text needs updating and never fights the
 * writes. The first render (server and client alike) is `format(value)`, so
 * hydration matches.
 *
 * ## Behaviour
 *
 * - **Retargets from what is on screen.** If `value` changes mid-tween, the
 *   running tween stops and the next one starts from the figure currently
 *   shown, not from the old target. The number never jumps.
 * - **Whole numbers stay whole** while tweening when both ends are integers, so
 *   a count never shows `12.4 jobs` on the way to 15.
 * - **Reduced motion, `duration <= 0`, or a non-finite value:** the text
 *   becomes `format(value)` at once, no tween. `NaN`/`Infinity` have nothing to
 *   interpolate toward, so whatever `format` makes of them is shown as is.
 * - **`tnum` always**, so digits keep their width and the figure does not
 *   jitter sideways as it counts.
 * - **Cleaned up** on unmount and whenever the target changes.
 *
 * ## Why it is not a live region, and has no hidden copy
 *
 * The node is a plain span. Nothing is announced while it counts, so a screen
 * reader is not read forty figures in a second. The text always converges to
 * the final formatted value, so a reader that reaches it afterwards, or a user
 * who selects and copies it, gets the right number; only someone landing on it
 * inside the 600ms window could meet a mid-count value. The alternative
 * (aria-hidden counting span plus a visually hidden final value) fixes that
 * window at the price of the figure existing twice in the DOM: duplicated on
 * copy, in find-in-page, in text-based tests and in reader mode. The window is
 * the smaller problem, so this renders once.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  animateOnMount = false,
  duration = 600,
}: AnimatedNumberProps) {
  const textRef = useRef<HTMLSpanElement>(null);

  // Frozen on purpose: see "How it stays out of React's way".
  const [initialText] = useState(() => format(value));

  /** The figure currently on screen, which may be mid-tween. */
  const shown = useRef(value);
  const running = useRef<{ stop: () => void } | null>(null);
  const mounted = useRef(false);

  // The latest `format`, for tween frames that outlive the render that started
  // them. Declared before the effects below so it is current when they run.
  const formatRef = useRef(format);
  useIsoLayoutEffect(() => {
    formatRef.current = format;
  });

  // Keeps the text honest when something other than `value` changed what it
  // should say (a currency switch changes `format`, not `value`). Skipped while
  // a tween is running, whose next frame writes with the latest `format`.
  useIsoLayoutEffect(() => {
    const el = textRef.current;
    if (!el || running.current) return;
    const text = format(shown.current);
    if (el.textContent !== text) el.textContent = text;
  });

  useIsoLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const isMount = !mounted.current;
    mounted.current = true;

    let from = shown.current;
    if (isMount) {
      if (!animateOnMount) return; // `initialText` already says `format(value)`.
      from = 0;
    } else if (from === value) {
      return;
    }

    const write = (n: number) => {
      el.textContent = formatRef.current(n);
    };

    if (
      duration <= 0 ||
      !Number.isFinite(value) ||
      !Number.isFinite(from) ||
      prefersReducedMotion()
    ) {
      shown.current = value;
      write(value);
      return;
    }

    // Counts stay whole numbers on the way: 12 to 15 reads 13, 14, 15.
    const whole = Number.isInteger(value) && Number.isInteger(from);

    write(from);
    const controls = animate(from, value, {
      duration: duration / 1000,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        const next = whole ? Math.round(latest) : latest;
        shown.current = next;
        write(next);
      },
      onComplete: () => {
        shown.current = value;
        write(value);
        running.current = null;
      },
    });
    running.current = controls;

    return () => {
      controls.stop();
      if (running.current === controls) running.current = null;
    };
  }, [value, animateOnMount, duration]);

  // React's development unmount-and-remount: without this the second pass would
  // not count as a mount, and `animateOnMount` would be skipped in development.
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  return (
    <span ref={textRef} className={cn("tnum", className)}>
      {initialText}
    </span>
  );
}
