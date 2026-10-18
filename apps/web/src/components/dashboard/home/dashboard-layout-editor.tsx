"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { IconCheck, IconGripVertical, IconRotateClockwise } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ALL_WIDGETS } from "@/hooks/use-dashboard-widget-prefs";
import { MousePenSensor } from "@/lib/dnd-sensors";
import {
  DASHBOARD_GRID,
  WIDGET_COLUMNS,
  isArrangeableWidget,
  placeWidgets,
  widgetSpanClasses,
  type ArrangeableWidget,
  type PlacedWidget,
} from "@/lib/dashboard-layout";
import { DUR, EASE_OUT_CSS, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface DashboardLayoutEditorProps {
  /** The visible cards, in their current order. */
  order: ArrangeableWidget[];
  onMove: (active: ArrangeableWidget, over: ArrangeableWidget) => void;
  onReset: () => void;
  /** False while the order is already the default, so Reset has nothing to do. */
  canReset: boolean;
  onDone: () => void;
}

function widgetLabel(id: UniqueIdentifier): string {
  return ALL_WIDGETS.find((w) => w.key === id)?.label ?? String(id);
}

/**
 * Nothing shifts while a card is held. Cards here are one, two or three columns
 * wide and the rows re-pack after every move, so sliding the others into each
 * other's slots (what dnd-kit's grid strategy does) would preview a layout the
 * drop does not produce. The card under the pointer shows where the held one
 * will land instead, and the grid re-packs once, on the drop.
 */
const holdStill: SortingStrategy = () => null;

const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${widgetLabel(active.id)}.`,
  onDragOver: ({ active, over }) =>
    over && over.id !== active.id
      ? `${widgetLabel(active.id)} will take ${widgetLabel(over.id)}'s place.`
      : `${widgetLabel(active.id)} is over its own place.`,
  onDragEnd: ({ active, over }) =>
    over && over.id !== active.id
      ? `${widgetLabel(active.id)} moved to ${widgetLabel(over.id)}'s place.`
      : `${widgetLabel(active.id)} left where it was.`,
  onDragCancel: ({ active }) => `Moving ${widgetLabel(active.id)} cancelled.`,
};

const screenReaderInstructions = {
  draggable:
    "To move this card, press Space or Enter, use the arrow keys to reach the card whose place it should take, then press Space or Enter again. Escape cancels.",
};

/**
 * The dashboard laid out as a map of its cards, for rearranging them.
 *
 * Each card becomes a short tile in the same grid, with the same widths, so
 * the whole page fits on one screen and a move is a short drag, not a scroll
 * through charts with a card held. Charts also answer to the pointer, which a
 * drag across the live page would set off. Done puts the real cards back in
 * the new order.
 */
export function DashboardLayoutEditor({
  order,
  onMove,
  onReset,
  canReset,
  onDone,
}: DashboardLayoutEditorProps) {
  const placed = placeWidgets(order);
  const [activeKey, setActiveKey] = useState<ArrangeableWidget | null>(null);

  // The card just dropped wears the highlight once in its new place.
  const [movedKey, setMovedKey] = useState<ArrangeableWidget | null>(null);
  const movedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (movedTimer.current) clearTimeout(movedTimer.current);
    },
    [],
  );

  // Mouse and pen lift a tile after 8px; a finger has to press and hold, so a
  // swipe across the tiles still scrolls the page on a phone.
  const sensors = useSensors(
    useSensor(MousePenSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dropAnimation: DropAnimation | null = prefersReducedMotion()
    ? null
    : {
        duration: DUR.state,
        easing: EASE_OUT_CSS,
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: "0" } },
        }),
      };

  function handleDragStart({ active }: DragStartEvent) {
    const key = String(active.id);
    setActiveKey(isArrangeableWidget(key) ? key : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveKey(null);
    if (!over || over.id === active.id) return;
    const from = String(active.id);
    const to = String(over.id);
    if (!isArrangeableWidget(from) || !isArrangeableWidget(to)) return;
    onMove(from, to);
    if (movedTimer.current) clearTimeout(movedTimer.current);
    setMovedKey(from);
    movedTimer.current = setTimeout(() => setMovedKey(null), 1600);
  }

  return (
    <div className="space-y-6">
      {/* Sticks under the navbar, so Done is in reach wherever the drag ends. */}
      <div className="motion-appear sticky top-16 z-10 flex flex-col gap-3 rounded-lg border border-brand/30 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-foreground">
            Arrange your dashboard
          </p>
          <p className="mt-0.5 max-w-prose text-xs text-muted-foreground font-body">
            Drag a card onto another to put it in that card&apos;s place. Wide cards
            take two columns, so two of them never share a row, and a card left
            alone at the end of a row widens to fill it. The overdue alert and the
            KPI tiles stay at the top.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!canReset}
            className="h-10 flex-1 sm:h-8 sm:flex-none"
          >
            <IconRotateClockwise className="h-4 w-4" />
            Reset layout
          </Button>
          <Button
            size="sm"
            onClick={onDone}
            className="h-10 flex-1 bg-brand text-brand-foreground hover:bg-brand/90 sm:h-8 sm:flex-none"
          >
            <IconCheck className="h-4 w-4" />
            Done
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveKey(null)}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <SortableContext items={order} strategy={holdStill}>
          <div className={DASHBOARD_GRID}>
            {placed.map((p) => (
              <LayoutTile key={p.key} placed={p} moved={p.key === movedKey} />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeKey ? (
            // The Lifted state from DESIGN.md: the job card's, for the one other
            // thing on the dashboard that can be picked up.
            <div className="flex h-full w-full cursor-grabbing items-center gap-3 rounded-xl border border-brand/40 bg-card px-4 shadow-xl ring-2 ring-brand/30 rotate-2 scale-[1.03]">
              <TileBody label={widgetLabel(activeKey)} wide={WIDGET_COLUMNS[activeKey] === 2} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function LayoutTile({ placed, moved }: { placed: PlacedWidget; moved: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging, isOver, activeIndex, index } =
    useSortable({ id: placed.key });

  // A drop puts the held card in this one's place and shifts the rest along,
  // so it lands before this card when it came from later in the order, and
  // after it when it came from earlier. The bar sits in the gap on that side:
  // left or right in a row, above or below in the phone's single column.
  const target = isOver && !isDragging && activeIndex !== -1;
  const lands = activeIndex < index ? "after" : "before";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="movable dashboard card"
      className={cn(
        "relative flex h-24 min-w-0 cursor-grab touch-manipulation select-none items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 active:cursor-grabbing",
        "transition-[border-color,box-shadow,opacity] duration-200",
        // The grab glow: this can be picked up (DESIGN.md, The Grab Glow Rule).
        "[@media(hover:hover)]:hover:border-brand/40 [@media(hover:hover)]:hover:shadow-[0_6px_24px_0px_hsl(var(--brand)/0.25)] dark:[@media(hover:hover)]:hover:shadow-[0_6px_24px_0px_hsl(var(--brand)/0.35)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
        target && "border-solid border-brand ring-2 ring-brand/30",
        moved && "motion-highlight",
        widgetSpanClasses(placed),
      )}
    >
      <TileBody label={widgetLabel(placed.key)} wide={WIDGET_COLUMNS[placed.key] === 2} />
      {target && (
        <span
          aria-hidden
          className={cn(
            "absolute rounded-full bg-brand",
            "max-md:inset-x-3 max-md:h-1 md:inset-y-3 md:w-1",
            lands === "before"
              ? "max-md:-top-3.5 md:-left-3.5"
              : "max-md:-bottom-3.5 md:-right-3.5",
          )}
        />
      )}
    </div>
  );
}

function TileBody({ label, wide }: { label: string; wide: boolean }) {
  return (
    <>
      <IconGripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-foreground">
        {label}
      </span>
      {wide && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-body">
          Wide
        </span>
      )}
    </>
  );
}
