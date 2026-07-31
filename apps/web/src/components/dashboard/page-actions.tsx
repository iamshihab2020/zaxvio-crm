"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * A slot in the navbar that any page can render its own controls into.
 *
 * Every dashboard page used to open with a `PageHeader`: an <h1> repeating the
 * title the navbar was already showing a few pixels above it, a subtitle that
 * mostly restated the nav item, and the page's action buttons. That cost about
 * 76px of vertical space on every page before a single row of real content, and
 * it also meant two <h1> elements per page — the navbar's and the header's —
 * which is invalid and gives screen-reader users two competing page titles.
 *
 * The title stays in the navbar, where it was already correct. The actions move
 * up beside it through this portal, so they keep working exactly as before
 * (they stay inside the page's own React tree, so their state, handlers and
 * context all still resolve) while rendering somewhere else in the DOM.
 *
 * Prop-drilling was the alternative and it does not work here: the navbar is a
 * sibling of the page content inside the layout, not an ancestor, so there is
 * no path to pass anything down.
 */

const PageActionsContext = createContext<HTMLElement | null>(null);

/** Wraps the navbar and the page content. Holds the slot element. */
export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <PageActionsSlotSetter.Provider value={setSlot}>
      <PageActionsContext.Provider value={slot}>
        {children}
      </PageActionsContext.Provider>
    </PageActionsSlotSetter.Provider>
  );
}

const PageActionsSlotSetter = createContext<
  ((el: HTMLElement | null) => void) | null
>(null);

/** Rendered once, inside the navbar. This is where page actions land. */
export function PageActionsSlot({ className }: { className?: string }) {
  const setSlot = useContext(PageActionsSlotSetter);
  return <div ref={setSlot} className={className} />;
}

/**
 * Render this anywhere in a page to put controls in the navbar.
 *
 * Returns null on the server and on the first client render, because the slot
 * element does not exist until the navbar has mounted. Actions therefore appear
 * one paint after the page — imperceptible, and the alternative (rendering them
 * in place first, then moving them) would visibly jump.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(PageActionsContext);
  if (!slot) return null;
  return createPortal(
    <div className="flex items-center gap-2">{children}</div>,
    slot,
  );
}
