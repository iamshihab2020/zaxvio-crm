"use client";

import { MotionConfig } from "motion/react";

/**
 * Makes every `motion/react` animation beneath it honour the operating
 * system's reduced-motion setting (LAND-07).
 *
 * Without it, none did: the tab underline spring, the tab panels' blur
 * cross-fade and auto-height, the accordion's slide, the Sheet and every
 * dashboard animation ran at full movement for a reader who had asked for
 * less. `reducedMotion="user"` turns off transform and layout animation when
 * that setting is on and keeps opacity and colour changes, so state still reads
 * as changing. It does not reach the CSS reveal or the theme wipe, which handle
 * the preference themselves (`globals.css`, `theme-toggler.tsx`).
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
 * includes anything built on `ui/dialog`, `ui/sheet`, `ui/tabs`,
 * `ui/accordion`, `ui/checkbox`, `ui/switch`, `ui/toggle`, `ui/progress`,
 * `ui/radio-group`, `ui/alert-dialog` or anything under `animate-ui/`.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
