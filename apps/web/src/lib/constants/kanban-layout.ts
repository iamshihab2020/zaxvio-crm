/**
 * Layout classes the Pipeline board shares with its skeleton.
 *
 * They live here rather than in `kanban-column.tsx` because the skeleton is the
 * board's `dynamic()` loading fallback: importing a constant from the column
 * would pull dnd-kit into the page's first bundle, which the split exists to
 * keep out.
 */

/**
 * A column's width. Below `md` a column is the screen less a 40px peek of the
 * next (the page's 2rem of gutters plus 2.5rem), capped at 20rem, and the board
 * snaps to each one (`.kanban-board-snap` in globals.css). Viewport units, not
 * percentages: the columns sit inside Radix ScrollArea's `display: table`
 * wrapper, which sizes to its content, so a percentage has nothing fixed to
 * resolve against. From `md` the columns share the row, never under 290px.
 */
export const KANBAN_COLUMN_WIDTH =
  "w-[min(20rem,calc(100vw_-_4.5rem))] shrink-0 snap-start snap-always md:w-auto md:min-w-[290px] md:flex-1";

/**
 * The stage rail's row: one cell per stage, sharing the width while each gets
 * at least 4.5rem, then scrolling sideways, so a long pipeline stays legible
 * instead of shrinking every label to an ellipsis.
 */
export const KANBAN_RAIL_GRID =
  "grid grid-flow-col auto-cols-[minmax(4.5rem,1fr)] gap-1.5";
