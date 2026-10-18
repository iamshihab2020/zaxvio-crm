/**
 * The motion vocabulary, for code that has to animate from JavaScript.
 *
 * The source of truth is the MOTION SYSTEM block in `app/globals.css`
 * (`--ease-out`, `--dur-*`). CSS animations read those variables; the Web
 * Animations API and `motion/react` cannot, so the same numbers are repeated
 * here. Change one place and you change the other, or the app starts speaking
 * with two accents.
 */

/**
 * `--ease-out` as the array `motion/react` takes: `transition={{ ease: EASE_OUT }}`.
 * Fast start, long soft landing; the one curve the app uses.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** `--ease-out` as the string the Web Animations API takes: `{ easing: EASE_OUT_CSS }`. */
export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Durations in milliseconds, matching the `--dur-*` variables.
 *
 * `motion/react` wants seconds: divide by 1000.
 */
export const DUR = {
  /** `--dur-feedback`: a press, a toggle. */
  feedback: 120,
  /** `--dur-state`: something changed in place. */
  state: 200,
  /** `--dur-arrive`: something new arrived. */
  arrive: 280,
  /** `--dur-focal`: the one authored moment. */
  focal: 700,
  /** `--dur-exit`: something leaving. Exits are quicker than entrances. */
  exit: 150,
} as const;

/** Route arrival: delay between siblings, and how many steps before the rest share the last one. */
export const STAGGER_STEP = 40;
export const STAGGER_MAX = 8;

/**
 * Lists, tables and grids that re-fill after a filter or page change. Denser
 * than a route arrival because there are more items and each is smaller.
 */
export const LIST_STAGGER_STEP = 20;
export const LIST_STAGGER_MAX = 12;

/**
 * Whether the reader asked the OS for less movement. SSR-safe: `false` on the
 * server, where nothing animates anyway.
 *
 * Read it when the animation starts, not at module load, so a change to the
 * setting applies on the next animation without a reload.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Delay for the `index`th item of a sequence. Item `max` and everything after
 * it share the last step's delay, so a 100-row table finishes with the first
 * dozen instead of taking two seconds to arrive.
 */
export function staggerDelay(index: number, step: number, max: number): number {
  return Math.min(index, Math.max(max, 1) - 1) * step;
}

export interface StaggerSpec {
  /** Starting offset in px; 0 fades without moving (the reduced-motion form). */
  rise: number;
  /** Per-child animation length in ms. */
  duration: number;
  /** Delay between consecutive children in ms; 0 starts them together. */
  step: number;
  /** Steps before the remaining children share the last delay. */
  max: number;
}

/**
 * Animates the direct children of `container` in sequence and returns the
 * animations, so a caller can cancel them if the content is replaced.
 *
 * - **Backwards fill, nothing after.** Each child holds its first keyframe
 *   through its delay, so it does not flash at full opacity before its turn,
 *   and leaves nothing behind when it lands. A lingering transform would make
 *   the child the containing block for any `position: fixed` descendant.
 * - **Only what can be seen.** Children with no box (`display: none`,
 *   `display: contents`) and children outside the viewport are skipped and do
 *   not use up a step. A 200-row table animates its first screenful; the rest
 *   are below the fold and would only be waiting.
 * - **Reads, then writes.** Every rectangle is measured before the first
 *   animation starts, because starting one invalidates style and a measurement
 *   after it would force a recalculation for each child.
 */
export function staggerChildren(
  container: Element,
  { rise, duration, step, max }: StaggerSpec,
): Animation[] {
  const viewportBottom = window.innerHeight;
  const targets: Element[] = [];
  for (const child of Array.from(container.children)) {
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.bottom <= 0 || rect.top >= viewportBottom) continue;
    targets.push(child);
  }

  const from: Keyframe =
    rise > 0
      ? { opacity: 0, transform: `translateY(${rise}px)` }
      : { opacity: 0 };
  const to: Keyframe =
    rise > 0 ? { opacity: 1, transform: "none" } : { opacity: 1 };

  return targets.map((child, index) =>
    child.animate([from, to], {
      duration,
      delay: staggerDelay(index, step, max),
      easing: EASE_OUT_CSS,
      fill: "backwards",
    }),
  );
}

/**
 * Plays a CSS motion class (`motion-shake`, `motion-pop`, `motion-highlight`)
 * again on an element that may already carry it.
 *
 * A CSS animation runs when its class is applied; applying a class that is
 * already there does nothing, so a second rejected submit would not shake.
 * Removing the class, flushing, and adding it back restarts the animation
 * without remounting the element, which matters on a form: a `key` change
 * would throw away what the user typed.
 *
 * The class is left on afterwards. At rest these classes do nothing (no fill),
 * and the next call removes and re-adds it. The reduced-motion override lives
 * in the class's CSS, so this needs no check of its own.
 */
export function replayMotion(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  // Reading a layout property flushes the removal. Without it the browser sees
  // the class as never having left and the animation is not restarted.
  void el.offsetWidth;
  el.classList.add(className);
}
