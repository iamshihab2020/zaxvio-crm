"use client";

import { useEffect, useRef, type RefObject } from "react";
import { replayMotion } from "@/lib/motion";

/**
 * Shakes the element the returned ref is attached to when `error` becomes a
 * new message: a rejected submit, said once in motion as well as in the text.
 *
 * - **Attach it to the form body, never to `DialogContent`.** The dialog is
 *   positioned with a transform, and a shake on it would replace that transform
 *   and make the dialog jump.
 * - **Only a message that was not already shown.** The error it opens with
 *   (the form re-mounting with the last one still in state) does not shake, and
 *   a retry that clears the error first and then fails again does.
 * - The reason must also be in text. Under reduced motion the shake is off.
 */
export function useShakeOnError<T extends HTMLElement>(
  error: string | null,
): RefObject<T> {
  const ref = useRef<T>(null);
  const shown = useRef(error);

  useEffect(() => {
    if (error && error !== shown.current && ref.current) {
      replayMotion(ref.current, "motion-shake");
    }
    shown.current = error;
  }, [error]);

  return ref;
}
