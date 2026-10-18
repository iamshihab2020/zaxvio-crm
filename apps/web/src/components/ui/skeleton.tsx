import { cn } from "@/lib/utils";

/**
 * A placeholder block. The loading treatment is a slow opacity pulse: no
 * spinners (DESIGN.md), and the shape of what is coming does the explaining.
 *
 * `motion-safe:` because Tailwind's pulse ignores `prefers-reduced-motion` by
 * itself. A reader who asked for less movement gets a still, muted block, which
 * is the same message without the loop.
 *
 * **When real content replaces a skeleton, give the content `motion-appear`**
 * (200ms opacity fade, `globals.css`). It is the skeleton-to-content utility;
 * there is no separate one. Put it on the element that swaps in, so the swap
 * reads as the data arriving instead of a hard cut. For a table or list that
 * refills, use `useStagger` instead.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
