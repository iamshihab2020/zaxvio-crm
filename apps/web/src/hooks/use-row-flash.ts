"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long a flagged row keeps its `motion-highlight` class. The wash itself
 * runs 1.2s; the rest is for a row that is not on screen yet. The mutation
 * hooks invalidate the list without awaiting it, so after a create the new row
 * only mounts when the refetch lands, and a shorter hold would clear the class
 * before the row arrived to carry it. Once the animation has played, the class
 * left on the row does nothing.
 */
const HOLD_MS = 3000;

/**
 * Which row of a list was just created or changed, for `.motion-highlight`.
 *
 * ```tsx
 * const { flashId, flash } = useRowFlash();
 * mutation.mutate(data, { onSuccess: (res) => { if (!res.error) flash(row.id); } });
 * // in the row:  className={cn(..., row.id === flashId && "motion-highlight")}
 * ```
 *
 * The id is state (the row re-renders with the class) and clears itself, so a
 * later render, a page change or a remount never replays a flash that was
 * already seen. Flashing the same id again while it is still held does not
 * restart the wash.
 */
export function useRowFlash(holdMs: number = HOLD_MS) {
  const [flashId, setFlashId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = useCallback(
    (id: string) => {
      clearTimeout(timer.current);
      setFlashId(id);
      timer.current = setTimeout(() => setFlashId(null), holdMs);
    },
    [holdMs],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { flashId, flash };
}
