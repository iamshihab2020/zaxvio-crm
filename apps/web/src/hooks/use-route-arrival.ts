"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import {
  DUR,
  EASE_OUT_CSS,
  STAGGER_MAX,
  STAGGER_STEP,
  prefersReducedMotion,
  staggerChildren,
} from "@/lib/motion";

/** The same isomorphic pattern `use-fill-viewport-height.ts` uses. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** How far content rises into place, in px. The language the app already spoke. */
const RISE_PX = 8;

/** Reduced motion: children fade together, with no travel and no wait. */
const REDUCED_FADE_MS = DUR.exit;

/**
 * How long after a navigation a `data-stagger` block that mounts late (the page
 * replacing its `loading.tsx` skeleton) still gets its arrival. Long enough for
 * a slow round trip; after it, a block appearing is a later change, not the
 * route arriving.
 */
const ARRIVAL_WINDOW_MS = 6000;

/** Outermost `data-stagger` blocks at or under `root`, skipping nested ones. */
function outerBlocks(root: Element): HTMLElement[] {
  const found: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.hasAttribute("data-stagger")) found.push(root);
  found.push(...Array.from(root.querySelectorAll<HTMLElement>("[data-stagger]")));
  // A block inside another would animate twice, once as a child of the outer
  // block and once as a block of its own.
  return found.filter((block) => !block.parentElement?.closest("[data-stagger]"));
}

/** Stagger each block's children. Returns how many children animated. */
function arriveBlocks(blocks: HTMLElement[], reduce: boolean): number {
  let staggered = 0;
  for (const block of blocks) {
    staggered += staggerChildren(
      block,
      reduce
        ? { rise: 0, duration: REDUCED_FADE_MS, step: 0, max: 1 }
        : { rise: RISE_PX, duration: DUR.arrive, step: STAGGER_STEP, max: STAGGER_MAX },
    ).length;
  }
  return staggered;
}

/**
 * Plays the route arrival on `ref` whenever the pathname changes: the page's
 * content rises 8px into place, the motion vocabulary in globals.css.
 *
 * ## `data-stagger`: the contract for page authors
 *
 * Mark a page's top-level containers with a bare `data-stagger` attribute and
 * their **direct children** arrive one after another instead of the whole page
 * rising at once:
 *
 * ```tsx
 * <div data-stagger className="grid grid-cols-4 gap-4">  // each tile in turn
 *   <StatTile /> <StatTile /> <StatTile /> <StatTile />
 * </div>
 * <div data-stagger className="space-y-6">               // each section in turn
 *   <RevenueCard /> <JobsCard />
 * </div>
 * ```
 *
 * - **Each child:** opacity 0 to 1 and `translateY(8px)` to 0 over
 *   `--dur-arrive`, on `--ease-out`, 40ms after the one before it. The ninth
 *   child and later share the eighth's delay (8 steps at most), so the wait
 *   never grows with the page.
 * - **Each block runs its own sequence from zero.** Two blocks on one page
 *   start together; they are not chained into a longer one.
 * - **`<main>` only fades** once any block animates, so the page never rises
 *   twice. Content outside every block still arrives with that fade. With no
 *   `data-stagger` anywhere, or none of the blocks having anything on screen,
 *   `<main>` rises as a whole, exactly as before: unmarked pages are unchanged.
 * - **Direct children only.** A grandchild is not touched; wrap what should move
 *   together in one child. A `data-stagger` inside another is ignored, so the
 *   outer block's children stay one unit.
 * - **Only what is on screen.** Children with no box and children below the
 *   fold are skipped and take no step. Do not mark a long list for this; give
 *   it `useStagger`, which suits many small items.
 * - **No skeletons, no `position: fixed` children.** A skeleton that staggers
 *   and is then replaced would arrive twice. A fixed child is offset while its
 *   sibling animates.
 * - **Present at navigation time, or mounting soon after it.** Most routes have
 *   a `loading.tsx`, so on an uncached visit the pathname changes while the
 *   SKELETON is on screen and the real page (with its `data-stagger` blocks)
 *   replaces it a round trip later. Reading the DOM only at the pathname change
 *   would find no blocks, and the page would arrive with no stagger on nearly
 *   every first visit. So for `ARRIVAL_WINDOW_MS` after a navigation the hook
 *   also watches `<main>` and staggers any block that mounts in that window, once.
 *   The watch runs in a MutationObserver, whose callback lands before the next
 *   paint, so a late block is never shown at rest first. Data that arrives later
 *   still, or inside an existing block, is `useStagger`'s and `.motion-appear`'s.
 * - **Reduced motion:** each child fades for 150ms with no travel and no
 *   stagger, and `<main>` itself does not animate (so nothing dims twice).
 *
 * ## Guarantees
 *
 * - **Never on first paint.** The server-rendered page is already on screen;
 *   animating it would only delay what the reader came for. The initial path
 *   is remembered, so React's double-invoked effects in development don't
 *   fire it either.
 * - **Before paint.** A layout effect, so the new page is never shown at rest
 *   for a frame and then snapped back to start the animation.
 * - **No fill after the end.** The Web Animations API leaves nothing behind
 *   once an animation ends (children use a backwards fill only, to hold their
 *   first frame through their delay). A lingering transform would make a
 *   container the containing block for every `position: fixed` child on the
 *   page.
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

    const reduce = prefersReducedMotion();

    const blocks = outerBlocks(el);
    const handled = new WeakSet<HTMLElement>(blocks);
    const staggered = arriveBlocks(blocks, reduce);

    // Blocks that mount after this moment, within the window: the page behind a
    // `loading.tsx` skeleton. Each is staggered once; `<main>` is not animated
    // again, it already arrived with the skeleton.
    let observer: MutationObserver | null = null;
    let windowTimer: ReturnType<typeof setTimeout> | null = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver((records) => {
        const late: HTMLElement[] = [];
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            for (const block of outerBlocks(node)) {
              if (handled.has(block)) continue;
              handled.add(block);
              late.push(block);
            }
          });
        }
        if (late.length > 0) arriveBlocks(late, reduce);
      });
      observer.observe(el, { childList: true, subtree: true });
      windowTimer = setTimeout(() => observer?.disconnect(), ARRIVAL_WINDOW_MS);
    }
    const stopWatching = () => {
      observer?.disconnect();
      if (windowTimer) clearTimeout(windowTimer);
    };

    if (staggered > 0) {
      // The children carry the arrival. `<main>` fades so the chrome around
      // them (a header outside every block) still arrives, but does not rise:
      // a rising parent under rising children is a double lift. Under reduced
      // motion the children's fade is already the change.
      if (!reduce) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DUR.state,
          easing: EASE_OUT_CSS,
        });
      }
      return stopWatching;
    }

    el.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${RISE_PX}px)` },
            { opacity: 1, transform: "none" },
          ],
      { duration: reduce ? DUR.state : DUR.arrive, easing: EASE_OUT_CSS },
    );
    return stopWatching;
  }, [pathname, ref]);
}
