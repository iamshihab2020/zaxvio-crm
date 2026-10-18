"use client";

import { useEffect, useState, type RefObject } from "react";
import { useStagger } from "@/hooks/use-stagger";

/**
 * Set by `SettingsNav` once the settings area has hydrated. The nav is part of
 * the layout, so a settings page that mounts after this is `true` was brought in
 * by a click, not by the browser loading the URL. The server never runs
 * effects, so it stays `false` there.
 */
let settingsHydrated = false;

/** Called once, by `SettingsNav`. */
export function useMarkSettingsHydrated(): void {
  // A page and the layout hydrate in the same pass, and a child's render runs
  // before any effect, so a page that came with the URL always reads `false`.
  useEffect(() => {
    settingsHydrated = true;
  }, []);
}

/**
 * Lays a settings page's cards down in turn when the page mounts because of a
 * client-side navigation, and not on the first paint of a full page load.
 *
 * The route arrival (`data-stagger`) covers a page that is already in the tree
 * when the navigation commits. It cannot cover one that streams in a moment
 * later behind `settings/loading.tsx`, which is most of them on a first visit:
 * those pages fetch the tenant on the server, so the skeleton shows and is then
 * replaced. This runs for that case. When both fire for the same commit they
 * animate the same children over the same distance and the later one simply
 * replaces the earlier, so nothing moves twice.
 *
 * Put the ref on the same element as `data-stagger`. The decision is read once
 * while rendering, so it cannot flip after hydration or mismatch.
 */
export function useArrivalStagger<T extends HTMLElement>(
  ref: RefObject<T | null>,
): void {
  const [arrived] = useState(() => settingsHydrated);
  useStagger(ref, "arrived", { onMount: arrived });
}
