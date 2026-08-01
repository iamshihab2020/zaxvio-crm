"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Height that makes an element run from where it sits to the bottom of the
 * viewport.
 *
 * The Kanban board previously hardcoded `calc(100vh - 12.5rem)`. That number
 * had to stand for the navbar, the page's top padding, the toolbar row, the
 * board's own padding and the horizontal scrollbar all at once — and it was
 * about 3.5rem too generous, so the columns stopped roughly 60px above the fold
 * and clipped a card mid-row while empty space sat underneath. Worse, the
 * column's inner scroller repeated the same constant with a second fudge
 * (`- 60px`) for the column header, so any change had to be made in two places
 * and kept in agreement.
 *
 * Measuring removes both numbers, and unlike the constant it stays correct when
 * the toolbar wraps to two rows on a narrow window or the impersonation banner
 * pushes everything down.
 */

/** Breathing room below the element, in px. */
const GUTTER = 12;

/** SSR and the first paint, before a measurement exists. */
const FALLBACK = "calc(100vh - 9.5rem)";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useFillViewportHeight(
  ref: RefObject<HTMLElement | null>,
  gutter: number = GUTTER,
): string {
  const [height, setHeight] = useState<string>(FALLBACK);
  const gutterRef = useRef(gutter);
  gutterRef.current = gutter;

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const top = el.getBoundingClientRect().top;
      // Guard against a scrolled or detached element reporting a negative or
      // absurd top, which would collapse the board to nothing.
      const available = window.innerHeight - top - gutterRef.current;
      setHeight(available > 240 ? `${Math.round(available)}px` : FALLBACK);
    };

    measure();

    window.addEventListener("resize", measure);
    // The toolbar above can change height (filters wrapping, a banner
    // appearing) without the window resizing.
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [ref]);

  return height;
}
