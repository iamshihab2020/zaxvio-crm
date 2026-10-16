"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";

/** The same isomorphic pattern `use-fill-viewport-height.ts` uses. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Matches `--ease-out` and `--dur-arrive` / `--dur-state` in globals.css. */
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const ARRIVE_MS = 280;
const STATE_MS = 200;

/**
 * Plays the route arrival on `ref` whenever the pathname changes: the page's
 * content rises 8px into place, the motion vocabulary in globals.css.
 *
 * - **Never on first paint.** The server-rendered page is already on screen;
 *   animating it would only delay what the reader came for. The initial path
 *   is remembered, so React's double-invoked effects in development don't
 *   fire it either.
 * - **Before paint.** A layout effect, so the new page is never shown at rest
 *   for a frame and then snapped back to start the animation.
 * - **No fill.** The Web Animations API with no `fill` leaves nothing behind
 *   when it ends. A lingering transform would make this container the
 *   containing block for every `position: fixed` child on the page.
 * - **No remount.** It animates the element that is already there, so it can
 *   wrap a layout without the `template.tsx` problem strict-rules §7 forbids.
 * - **Reduced motion:** a short fade only. The page changing must still read
 *   as a change.
 */
export function useRouteArrival<T extends HTMLElement>(ref: RefObject<T | null>) {
  const pathname = usePathname();
  const initialPath = useRef(pathname);
  const navigated = useRef(false);

  useIsoLayoutEffect(() => {
    if (!navigated.current && pathname === initialPath.current) return;
    navigated.current = true;

    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
      { duration: reduce ? STATE_MS : ARRIVE_MS, easing: EASE_OUT },
    );
  }, [pathname, ref]);
}
