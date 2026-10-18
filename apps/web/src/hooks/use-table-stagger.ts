"use client";

import type { RefObject } from "react";
import { useStagger, type StaggerKey } from "@/hooks/use-stagger";

/** Rows fade in with no rise; see `useTableStagger` for why. */
const TABLE_ROWS = { rise: 0 } as const;

/**
 * `useStagger` for a table body: the rows fade in one after another.
 *
 * ```tsx
 * const bodyRef = useRef<HTMLTableSectionElement>(null);
 * useTableStagger(bodyRef, loading || query.isPlaceholderData ? null : `${page}:${tab}:${search}`);
 * <TableBody ref={bodyRef}>
 * ```
 *
 * There is no rise (`useStagger` defaults to 6px) because `Table`
 * (`ui/table.tsx`) wraps the `<table>` in an `overflow-auto` box exactly as
 * tall as the table. A scroll container counts transformed descendants in its
 * scrollable overflow, so a last row starting 6px low sticks out of the bottom
 * and summons a vertical scrollbar for the length of the animation. On Windows
 * that bar is 15px wide and reflows the whole table. Opacity has no such side
 * effect.
 *
 * The key is the whole API: it must change when the rows on screen are a
 * different set (page, tab, sort, search), and be `null` while they are loading
 * or while the previous list is held over as placeholder data. See `useStagger`.
 */
export function useTableStagger(
  ref: RefObject<HTMLTableSectionElement | null>,
  key: StaggerKey,
): void {
  useStagger(ref, key, TABLE_ROWS);
}
