"use client";

import { useCallback, useRef } from "react";
import { replayMotion } from "@/lib/motion";

/**
 * A rejected submit, answered on the form itself: one 300ms shake.
 *
 * ```tsx
 * const { ref, shake } = useFormShake();
 * <form ref={ref} onSubmit={form.handleSubmit(onValid, shake)}>
 * ```
 *
 * It is a signal, not the message. The reason must already be on screen as text
 * and a field border, because under reduced motion `.motion-shake` does
 * nothing at all. Attach `ref` to an element that sits inside the dialog's
 * padding: a 4px shift of something flush with a scrolling container's edge
 * would flash a horizontal scrollbar.
 *
 * `shake` takes no arguments (RHF passes the field errors, which it ignores), so
 * it can be handed straight to `handleSubmit` or called from a manual check.
 */
export function useFormShake<T extends HTMLElement = HTMLFormElement>() {
  const ref = useRef<T>(null);
  const shake = useCallback(() => {
    if (ref.current) replayMotion(ref.current, "motion-shake");
  }, []);
  return { ref, shake };
}
