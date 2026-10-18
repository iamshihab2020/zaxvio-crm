import type { CSSProperties } from "react";
import { DUR, prefersReducedMotion } from "@/lib/motion";

/**
 * The motion props every Recharts series on the dashboard and /reports takes:
 * `<Bar {...chartAnimation()} />`.
 *
 * A series draws itself in when its chart first appears and again when its
 * data changes, over the focal duration on an ease-out. Call it inside the
 * component, not at module load: the reader's reduced-motion setting is read
 * when the chart renders, and `isAnimationActive` then turns the draw-in off.
 * Recharts renders nothing on the server (`ResponsiveContainer` needs a
 * measured box), so this never disagrees with the server HTML.
 */
export function chartAnimation(): {
  isAnimationActive: boolean;
  animationDuration: number;
  animationEasing: "ease-out";
} {
  return {
    isAnimationActive: !prefersReducedMotion(),
    animationDuration: DUR.focal,
    animationEasing: "ease-out",
  };
}

/**
 * The inline style that holds a `.motion-grow-x` / `.motion-grow-y` / `.motion-pop`
 * back by `ms`, so a row of bars arrives in order. `CSSProperties` has no custom
 * properties, hence the intersection with the one variable the class reads.
 */
export function enterDelay(ms: number): CSSProperties & Record<"--enter-delay", string> {
  return { "--enter-delay": `${ms}ms` };
}
