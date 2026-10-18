"use client";

import { useEffect, useRef, useState } from "react";

const NONE: ReadonlySet<string> = new Set();

/**
 * The ids in `ids` that were not there on the previous render, held for
 * `holdMs` so a row can wear `motion-highlight` once and then let it go.
 *
 * ```tsx
 * const fresh = useNewIds(rows.map((r) => r.id), !query.isLoading);
 * <tr className={cn(fresh.has(row.id) && "motion-highlight")} />
 * ```
 *
 * For lists whose rows come back from a refetch after an action, where the
 * component never learns the new row's id from the mutation itself: a line
 * item added, a cost logged, a stage created.
 *
 * - **`enabled` is "the data is real".** While it is false (a query still
 *   loading) nothing is learned, so the first rows to arrive are the baseline
 *   rather than a hundred new ones. Going back to false forgets the baseline,
 *   so a panel that closes and reopens starts quiet again.
 * - **The first enabled render is quiet.** Only a row that appears after that
 *   counts as new.
 * - **A refetch that returns the same ids changes nothing.** The signature is
 *   the joined ids, not the array, so identity churn never retriggers it.
 * - **Held, not permanent.** The highlight animation itself runs once whenever
 *   its class is applied and leaves nothing behind; the hold only stops a row
 *   that remounts later (a tab switched away from and back) from flashing again.
 */
export function useNewIds(
  ids: readonly string[],
  enabled = true,
  holdMs = 3000,
): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(NONE);
  const signature = ids.join("\u0000");

  useEffect(() => {
    if (!enabled) {
      seen.current = null;
      return;
    }
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const known = seen.current;
    const added = ids.filter((id) => !known.has(id));
    seen.current = new Set(ids);
    if (added.length === 0) return;

    setFresh((prev) => new Set([...prev, ...added]));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setFresh((prev) => {
        const next = new Set(prev);
        for (const id of added) next.delete(id);
        return next;
      });
    }, holdMs);
    timers.current.add(timer);
    // `ids` is represented by `signature`; listing the array would re-run on
    // every render that builds a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, holdMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return fresh;
}
