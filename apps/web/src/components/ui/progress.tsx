"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive.Root
> & {
  /**
   * Draw the fill in from empty once, when the bar mounts. Off by default so a
   * bar that is already on screen when the page loads does not replay. Turn it
   * on for a bar that appears after its data does (a report tab, a panel that
   * opens), where the fill growing says "this is how full it is".
   */
  drawIn?: boolean;
};

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, drawIn = false, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className,
    )}
    {...props}
  >
    {/* The fill is a full-width bar scaled from its left edge, so a change in
        `value` is a transform transition: nothing reflows, and the server
        renders the right fill with no entrance to replay. It has no rounding of
        its own (the track clips it), so scaling it distorts nothing. */}
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 origin-left bg-primary transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        drawIn && "motion-grow-x",
      )}
      style={{
        transform: `scaleX(${Math.min(Math.max(value || 0, 0), 100) / 100})`,
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
