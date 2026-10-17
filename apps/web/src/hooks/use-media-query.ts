"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tailwind's default breakpoints as media queries, so a component that needs
 * the breakpoint in JS asks the same question its `sm:` / `md:` / `lg:` classes
 * do. Writing the strings out at each call site is how a hook and its CSS drift
 * apart.
 */
export const MEDIA = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
} as const;

/**
 * Whether a CSS media query currently matches.
 *
 * Nothing like this existed, because CSS answers almost every responsive
 * question on its own and should. Reach for it only where the answer changes
 * what is rendered rather than how it looks: the number of calendar months in a
 * popover, or whether a control portals into the navbar or stays in the page.
 *
 * Returns `false` on the server and during hydration, then the real value in
 * the same commit that follows. Code that branches on it therefore renders its
 * small-screen form first on a wide screen; keep that form cheap, or gate it
 * behind something that is already null until mount (as `PageActions` does).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
