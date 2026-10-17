import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one box every dashboard chart tooltip sits in.
 *
 * Four widgets each hand-rolled a near-black `bg-foreground/95` bubble with
 * `rounded-2xl`, a ring and `shadow-2xl`, which is the wrong surface in either
 * theme: DESIGN.md puts popovers on Card White with a hairline border and a
 * small shadow, the same as the HoverCard and Select menus beside them. This is
 * that surface, so a chart tooltip and a week-ahead hover card read as one
 * family. Children set their own text sizes; use `text-muted-foreground` for
 * labels and `tnum` on figures.
 *
 * `font-body` is a reset, not a style: Recharts mounts the tooltip inside the
 * chart wrapper, and the charts that set `font-mono` on that wrapper (so their
 * SVG axis ticks come out in the figures face) would otherwise hand it down.
 */
export function ChartTooltipBox({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-popover px-3 py-2 font-body text-popover-foreground shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
