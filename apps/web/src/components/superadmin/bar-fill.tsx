"use client";

import { cn } from "@/lib/utils";
import { useArrivedByNavigation } from "./use-arrived-by-navigation";

/**
 * The coloured part of a horizontal meter: `percent` of its track, drawn in
 * from the left when the page was reached by navigation.
 *
 * The width is real (it is laid out from the start) and the draw-in is a
 * `scaleX` from zero, so nothing reflows. The track around it supplies the
 * height and background. `index` staggers a stack of them in reading order.
 *
 * It does not draw when the page is what the browser just loaded: the figures
 * beside it are already on screen, and the bar should be too.
 */
export function BarFill({
  percent,
  index = 0,
  className,
}: {
  percent: number;
  index?: number;
  className?: string;
}) {
  const draw = useArrivedByNavigation();
  const style: React.CSSProperties & Record<"--enter-delay", string> = {
    width: `${percent}%`,
    "--enter-delay": `${index * 60}ms`,
  };

  return (
    <div
      className={cn("h-full rounded-full", draw && "motion-grow-x", className)}
      style={style}
    />
  );
}
