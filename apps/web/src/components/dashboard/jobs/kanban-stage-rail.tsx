"use client";

import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { KANBAN_RAIL_GRID } from "@/lib/constants/kanban-layout";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface RailStage {
  id: string;
  name: string;
  label: string;
  color: string;
}

interface KanbanStageRailProps {
  stages: RailStage[];
  /**
   * Jobs per stage name, from the board's own copy rather than the server's,
   * so a held card is counted in the stage it is hovering over.
   */
  counts: Record<string, number>;
  /** The column on screen. */
  activeIndex: number;
  onSelect: (index: number) => void;
  /** A card is being held, so every cell is also a drop target. */
  dragging: boolean;
  className?: string;
}

/**
 * The board in miniature, for a phone, where the board itself shows one column
 * at a time.
 *
 * One cell per stage in board order, topped with its column's colour and
 * carrying its count, so the whole pipeline reads at a glance without swiping
 * through it. The blue cell is the column on screen; tapping another scrolls
 * the board there. While a card is held every cell is a drop target, which is
 * how a job crosses the pipeline on a phone: holding it at the screen's edge
 * while the board creeps four columns over is not a gesture anyone finishes.
 */
export function KanbanStageRail({
  stages,
  counts,
  activeIndex,
  onSelect,
  dragging,
  className,
}: KanbanStageRailProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  // A long pipeline scrolls this row, so keep the cell for the column on screen
  // in view as the board is swiped. Only the row scrolls: `scrollIntoView`
  // would move the page as well.
  useEffect(() => {
    const row = rowRef.current;
    const cell = row?.children.item(activeIndex);
    if (!row || !(cell instanceof HTMLElement)) return;
    if (row.scrollWidth <= row.clientWidth) return;
    const rowRect = row.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const margin = 16;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    if (cellRect.left < rowRect.left + margin) {
      row.scrollBy({ left: cellRect.left - rowRect.left - margin, behavior });
    } else if (cellRect.right > rowRect.right - margin) {
      row.scrollBy({ left: cellRect.right - rowRect.right + margin, behavior });
    }
  }, [activeIndex]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label="Pipeline stages"
      className={cn(
        KANBAN_RAIL_GRID,
        "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {stages.map((stage, index) => (
        <RailCell
          key={stage.id}
          stage={stage}
          count={counts[stage.name] ?? 0}
          active={index === activeIndex}
          dragging={dragging}
          onSelect={() => onSelect(index)}
        />
      ))}
    </div>
  );
}

function RailCell({
  stage,
  count,
  active,
  dragging,
  onSelect,
}: {
  stage: RailStage;
  count: number;
  active: boolean;
  dragging: boolean;
  onSelect: () => void;
}) {
  // `type: "column"` is all the board's drag handlers need to treat a drop here
  // as a drop on that stage's column. `source` is how its collision rule tells
  // a cell from a real column (kanban-board.tsx).
  const { isOver, setNodeRef } = useDroppable({
    id: `rail:${stage.id}`,
    data: { type: "column", stageName: stage.name, source: "rail" },
  });
  const colors = getStageColors(stage.color);

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      aria-label={`${stage.label}, ${count} ${count === 1 ? "job" : "jobs"}`}
      className={cn(
        // 44px tall: the phone's touch target, and room for the count over its
        // label. The top edge is the column's own 3px colour rule.
        "flex min-h-11 min-w-0 flex-col items-start justify-center rounded-lg border border-t-[3px] px-2.5 py-1 text-left transition-colors duration-200",
        active
          ? "border-brand/50 bg-brand-light/40 dark:border-brand/50 dark:bg-brand/15"
          : "border-border/60 bg-card dark:border-border/40 dark:bg-muted/15",
        colors.borderTop,
        // Dashed sides while a card is held: every cell will take it. The top
        // rule stays solid so the stage colour still reads.
        dragging && "border-dashed [border-top-style:solid]",
        isOver && ["ring-2", colors.ring, colors.bg],
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold leading-tight tabular-nums",
          active ? "text-brand-ink dark:text-brand" : "text-foreground",
        )}
      >
        <AnimatedNumber value={count} format={String} duration={300} />
      </span>
      <span
        className={cn(
          "w-full truncate text-[11px] leading-tight font-body",
          active ? "text-brand-ink dark:text-brand" : "text-muted-foreground",
        )}
      >
        {stage.label}
      </span>
    </button>
  );
}
