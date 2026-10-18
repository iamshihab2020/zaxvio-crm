"use client";

import { useEffect, useState } from "react";

/**
 * Set by `SuperadminShell` once the admin area has hydrated. The shell is the
 * layout and is mounted for the whole visit, so a page component that mounts
 * after this is `true` was brought in by a click, not by the browser loading
 * the URL. The server never runs effects, so it stays `false` there.
 */
let shellHydrated = false;

/** Called once, by `SuperadminShell`. */
export function useMarkShellHydrated(): void {
  // A page and the shell hydrate in the same pass, and a child's render runs
  // before any effect, so a page that loaded with the URL always reads `false`.
  useEffect(() => {
    shellHydrated = true;
  }, []);
}

/**
 * Whether this component mounted because of a client-side navigation.
 *
 * For motion that is allowed to play on a navigation but not on the first
 * paint of a full page load: a bar drawing itself in from nothing, for
 * instance. A CSS animation runs on server-rendered markup the moment the page
 * paints, so unlike the hooks that wait for a change, a class like
 * `motion-grow-x` has to be withheld from the HTML a page load delivers. The
 * value is read once while rendering (a state initializer), so it cannot flip
 * after hydration and never causes a mismatch.
 */
export function useArrivedByNavigation(): boolean {
  const [arrived] = useState(() => shellHydrated);
  return arrived;
}
