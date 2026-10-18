"use client";

import { MotionConfig } from "motion/react";

/**
 * Makes every `motion/react` animation beneath it honour the operating
 * system's reduced-motion setting (LAND-07).
 *
 * Without it, none did: the tab underline spring, the tab panels' blur
 * cross-fade and auto-height, the checkbox and switch springs, the bulk action
 * bar and every dashboard animation ran at full movement for a reader who had
 * asked for less. `reducedMotion="user"` turns off transform and layout
 * animation when that setting is on and keeps opacity and colour changes, so
 * state still reads as changing. It does not reach the CSS motion classes, the
 * overlays or the theme wipe, which handle the preference themselves
 * (`globals.css`, `theme-toggler.tsx`).
 *
 * ## Where it is mounted, and why not at the root
 *
 * In the five route-group layouts whose pages use motion: `(dashboard)`,
 * `(superadmin)`, `(blog)`, `(legal)` and the `(landing)` page. It was at the
 * root first, which put `motion/react` into the bundle of every route —
 * including the public booking portal, the quote page, the auth pages and the
 * unsubscribe page, none of which import anything from it (LAND-09).
 *
 * **A new route that renders a motion component needs this around it.** That
 * is anything that imports `motion/react`: `ui/checkbox`, `ui/switch`,
 * `ui/toggle`, `ui/toggle-group`, `ui/tabs` and anything under `animate-ui/`,
 * plus the few feature components that animate with it directly (the bulk
 * action bar). `AnimatedNumber` checks the preference itself and needs nothing.
 *
 * It is not needed for `ui/dialog`, `ui/sheet`, `ui/alert-dialog`,
 * `ui/popover`, `ui/dropdown-menu`, `ui/select`, `ui/tooltip`, `ui/hover-card`,
 * `ui/accordion`, `ui/progress`, `ui/radio-group` or `ui/skeleton`: those run on
 * CSS (`animate-in`, the `motion-*` classes, transitions), which carries its own
 * `prefers-reduced-motion` overrides and does not load `motion/react`.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
