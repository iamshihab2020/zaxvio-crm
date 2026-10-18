"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DropAnimation,
  type PointerSensorOptions,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { KanbanCardCompact } from "./kanban-card-compact";
import { KanbanStageRail } from "./kanban-stage-rail";
import type { CardFieldVisibility } from "./card-fields-popover";
import type { AssigneeMember } from "./assignee-picker";
import { reorderJobs, updateJobStatus } from "@/actions/jobs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";
import { MEDIA, useMediaQuery } from "@/hooks/use-media-query";
import { useStagger } from "@/hooks/use-stagger";
import { DUR, EASE_OUT_CSS, prefersReducedMotion } from "@/lib/motion";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

/**
 * The stock PointerSensor, minus fingers.
 *
 * A pointer sensor with an 8px distance threshold treats the first 8px of any
 * touch as a drag, so on a phone a sideways swipe on a card lifted the card
 * instead of scrolling the board. Mouse and pen keep exactly that behaviour;
 * touch is handed to TouchSensor below, which waits for a press-and-hold.
 */
class MousePenSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: ReactPointerEvent,
        { onActivation }: PointerSensorOptions,
      ) => {
        if (event.pointerType === "touch") return false;
        if (!event.isPrimary || event.button !== 0) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/**
 * The board's collision rule, with the stage rail's cells on top of it.
 *
 * A rail cell counts only while the pointer is actually on it. Left to
 * `closestCorners` alongside the columns, the cells above the first column
 * would win whenever a card was held near the top of the board, and the card
 * would change stage without going anywhere near one.
 */
const detectCollisions: CollisionDetection = (args) => {
  const onRail = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => container.data.current?.source === "rail",
    ),
  });
  if (onRail.length > 0) return onRail;
  return closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => container.data.current?.source !== "rail",
    ),
  });
};

interface KanbanBoardProps {
  jobs: JobCardData[];
  stages: PipelineStage[];
  onJobClick: (jobId: string) => void;
  onStatusChange: () => void;
  onAddJob: (stageName: string) => void;
  cardView?: "default" | "compact";
  visibleFields?: CardFieldVisibility;
  members?: AssigneeMember[];
  onAssigneeChange?: (jobId: string, assigneeId: string | null) => void;
  onJobFieldChange?: (jobId: string, field: string, value: string) => void;
  /**
   * Which cards are on the board, for the column arrival stagger: the pipeline
   * once its stages and jobs have both arrived, `null` while the board still
   * shows the previous pipeline's. Never the jobs themselves, or every
   * background refetch would replay it.
   */
  arrivalKey?: string | null;
  /** A job that was just created or edited, to wear the highlight once. */
  highlightJobId?: string | null;
}

export function KanbanBoard({
  jobs,
  stages,
  onJobClick,
  onStatusChange,
  onAddJob,
  cardView = "default",
  visibleFields,
  members,
  onAssigneeChange,
  onJobFieldChange,
  arrivalKey,
  highlightJobId,
}: KanbanBoardProps) {
  const [localJobs, setLocalJobs] = useState<JobCardData[]>(jobs);
  const [activeJob, setActiveJob] = useState<JobCardData | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardHeight = useFillViewportHeight(scrollRef);
  const pendingMoveRef = useRef(false);
  const snapshotRef = useRef<JobCardData[]>([]);

  // Columns rise in turn when a pipeline's board arrives. Cards ride along with
  // their column rather than each carrying a motion of its own: a 500-card
  // board mounting 500 animated nodes was the cost of the old per-card version,
  // and a card dropped into a column mounted with its own rise, which fought
  // the drop settling into place.
  const columnsRef = useRef<HTMLDivElement>(null);
  useStagger(columnsRef, arrivalKey);

  // A card's pills, date and time open inline editors on a click. Below `md`
  // they stay plain text: each is about 20px tall, well under a finger's 40px,
  // and a tap that misses one by a few pixels should open the job, not a
  // calendar. The job opens full screen on a phone, where every one of those
  // fields is editable at a proper size.
  const inlineEditing = useMediaQuery(MEDIA.md);

  // The column on screen, for the stage rail: whichever shows the most of
  // itself. Read from the layout on scroll rather than computed from widths,
  // so it is right at any column width, and at the end of the row, where the
  // last column cannot reach the left edge to snap there.
  const [activeColumn, setActiveColumn] = useState(0);
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    const columns = columnsRef.current;
    if (!viewport || !columns) return;
    let frame = 0;
    function track() {
      frame = 0;
      if (!viewport || !columns) return;
      const view = viewport.getBoundingClientRect();
      let best = 0;
      let bestVisible = -Infinity;
      Array.from(columns.children).forEach((column, index) => {
        const rect = column.getBoundingClientRect();
        const visible =
          Math.min(rect.right, view.right) - Math.max(rect.left, view.left);
        if (visible > bestVisible) {
          bestVisible = visible;
          best = index;
        }
      });
      setActiveColumn(best);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(track);
    }
    track();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [stages]);

  /** Bring a column to the board's left edge, where the phone snap holds it. */
  function scrollToColumn(index: number) {
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    const column = columnsRef.current?.children.item(index);
    if (!viewport || !column) return;
    const offset =
      column.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
    viewport.scrollTo({
      left: viewport.scrollLeft + offset,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  // The card that just changed stage by drag, to wear the highlight once in its
  // new column. Cleared if the move is refused, or the card would flash in the
  // column it was put back into.
  const [movedJobId, setMovedJobId] = useState<string | null>(null);
  const movedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashMoved(jobId: string | null) {
    if (movedTimer.current) clearTimeout(movedTimer.current);
    setMovedJobId(jobId);
    if (jobId) movedTimer.current = setTimeout(() => setMovedJobId(null), 1600);
  }
  useEffect(
    () => () => {
      if (movedTimer.current) clearTimeout(movedTimer.current);
    },
    [],
  );
  const flashId = movedJobId ?? highlightJobId ?? null;

  // A dropped card settles into its slot instead of snapping: the overlay glides
  // from where the pointer let go to the card's place, on the system curve, and
  // the real card stays hidden until it lands. Read per render so a change to
  // the reduced-motion setting applies to the next drop.
  const dropAnimation: DropAnimation | null = prefersReducedMotion()
    ? null
    : {
        duration: DUR.state,
        easing: EASE_OUT_CSS,
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: "0" } },
        }),
      };

  // Sync from parent when jobs change — skip if a move is pending
  if (jobs !== localJobs && !activeJob && !pendingMoveRef.current) {
    setLocalJobs(jobs);
  }

  // Get jobs for a specific stage, maintaining sort order
  const getStageJobs = useCallback(
    (stageName: string) =>
      localJobs.filter((j) => j.status === stageName),
    [localJobs],
  );

  // Find which stage a job belongs to
  function findStageForJob(jobId: string): string | null {
    const job = localJobs.find((j) => j.id === jobId);
    return job?.status ?? null;
  }

  const checkScroll = useCallback(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;
    const { scrollLeft, scrollWidth, clientWidth } = viewport;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll, stages.length]);

  useEffect(() => {
    if (!activeJob) return;
    checkScroll();
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;
    viewport.addEventListener("scroll", checkScroll);
    return () => viewport.removeEventListener("scroll", checkScroll);
  }, [activeJob, checkScroll]);

  // Wheel-to-horizontal-scroll (trackpad / touch mouse)
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    function handleWheel(e: WheelEvent) {
      if (!viewport) return;
      // Let horizontal trackpad swipes through natively
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // Don't hijack vertical scroll if cursor is anywhere inside a column
      const target = e.target as HTMLElement;
      if (target.closest(".kanban-column-scroll")) return;
      // Convert vertical wheel to horizontal scroll on the board
      if (viewport.scrollWidth > viewport.clientWidth) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [stages.length]);

  // Grab-to-scroll
  const isDraggingScroll = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);

  function getViewport() {
    return scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (activeJob) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-dragging], [role="button"], button, a, input, [data-radix-scroll-area-scrollbar], [data-radix-scroll-area-thumb]')) return;

    const viewport = getViewport();
    if (!viewport) return;
    if (viewport.scrollWidth <= viewport.clientWidth) return;

    isDraggingScroll.current = true;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = viewport.scrollLeft;
    document.body.style.cursor = "grabbing";
    e.preventDefault();
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingScroll.current) return;
      const viewport = getViewport();
      if (!viewport) return;
      const dx = e.clientX - dragStartX.current;
      viewport.scrollLeft = scrollStartLeft.current - dx;
    }

    function handleMouseUp() {
      if (!isDraggingScroll.current) return;
      isDraggingScroll.current = false;
      document.body.style.cursor = "";
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Touch lifts a card only after a 250ms hold that stays within 8px, so a quick
  // swipe is a scroll. Once lifted, the sensor cancels the scroll for the drag.
  const sensors = useSensors(
    useSensor(MousePenSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    if (isDraggingScroll.current) {
      isDraggingScroll.current = false;
      document.body.style.cursor = "";
    }
    snapshotRef.current = [...localJobs];
    const job = event.active.data.current?.job as JobCardData | undefined;
    if (job) setActiveJob(job);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the source stage
    const activeStage = findStageForJob(activeId);
    if (!activeStage) return;

    // Determine the target stage
    let overStage: string | null = null;

    // If hovering over a column droppable
    if (over.data.current?.type === "column") {
      overStage = over.data.current.stageName as string;
    } else {
      // Hovering over another card — find its stage
      overStage = findStageForJob(overId);
    }

    if (!overStage || activeStage === overStage) return;

    // Move card to new column (cross-column move)
    setLocalJobs((prev) => {
      const updated = prev.map((j) =>
        j.id === activeId ? { ...j, status: overStage } : j,
      );
      return updated;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveJob(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeStage = findStageForJob(activeId);
    if (!activeStage) return;

    // Determine target stage
    let overStage: string | null = null;
    if (over.data.current?.type === "column") {
      overStage = over.data.current.stageName as string;
    } else {
      overStage = findStageForJob(overId);
    }

    if (!overStage) return;

    const stageJobs = getStageJobs(overStage);

    // JOB-30: these two branches were independent `if`s, and dropping onto a
    // *card* in another column satisfied both — two concurrent writes for one
    // drop, last-wins. A drop is either a reposition or a move, never both:
    // decide once, here.
    const job = localJobs.find((j) => j.id === activeId);
    const originalJob = jobs.find((j) => j.id === activeId);
    const isCrossColumn = Boolean(
      job && originalJob && job.status !== originalJob.status,
    );

    // Reorder within the same stage
    if (
      !isCrossColumn &&
      activeId !== overId &&
      over.data.current?.type !== "column"
    ) {
      const oldIndex = stageJobs.findIndex((j) => j.id === activeId);
      const newIndex = stageJobs.findIndex((j) => j.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(stageJobs, oldIndex, newIndex);

        // Optimistic update
        setLocalJobs((prev) => {
          const otherJobs = prev.filter((j) => j.status !== overStage);
          return [...otherJobs, ...reordered];
        });

        // Positions only — /reorder no longer moves jobs between stages.
        reorderJobs(
          reordered.map((j, i) => ({ id: j.id, sortOrder: i })),
        ).then((result) => {
          if (result.error) {
            setLocalJobs(snapshotRef.current);
            toast.error("Failed to reorder");
          } else if (result.skipped.length > 0) {
            setLocalJobs(snapshotRef.current);
            toast.error(result.skipped[0].reason);
          }
        });
      }
    }

    // Cross-column move (status change)
    if (isCrossColumn && job) {
      const targetStage = stages.find((s) => s.name === job.status);
      const snapshot = snapshotRef.current;

      // Block parent sync while API is in flight
      pendingMoveRef.current = true;

      // The stage change goes through PATCH /:id/status — the one writer that
      // enforces the required-checklist gate and sends the completion email,
      // the notification and the activity row. /reorder only saves positions,
      // and only once the move itself is accepted.
      const targetJobs = localJobs.filter((j) => j.status === job.status);
      flashMoved(activeId);
      updateJobStatus(activeId, {
        stageId: targetStage?.id,
        status: targetStage ? undefined : job.status,
      }).then((result) => {
        if (result.error) {
          pendingMoveRef.current = false;
          flashMoved(null);
          setLocalJobs(snapshot);
          toast.error(result.error);
          return;
        }

        reorderJobs(
          targetJobs.map((j, i) => ({ id: j.id, sortOrder: i })),
        ).then(() => {
          pendingMoveRef.current = false;
          toast.success(`Job moved to ${targetStage?.label ?? job.status}`);
          onStatusChange();
        });
      });
    }
  }

  const stageCounts: Record<string, number> = {};
  for (const job of localJobs) {
    stageCounts[job.status] = (stageCounts[job.status] ?? 0) + 1;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollisions}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Outside `scrollRef`, which the board measures its height from. */}
      <KanbanStageRail
        stages={stages}
        counts={stageCounts}
        activeIndex={activeColumn}
        onSelect={scrollToColumn}
        dragging={activeJob !== null}
        className="motion-appear mb-3 md:hidden"
      />

      {/* The board fades in when it replaces the skeleton or a view switch.
          Opacity only: a transform here would offset dnd-kit's measurements. */}
      <div className="motion-appear relative" ref={scrollRef}>
        {/* `kanban-board-snap` stops a phone swipe on a column, never between
            two (globals.css). Off while a card is held, or the snap would fight
            dnd-kit's auto-scroll at the screen edge. */}
        <ScrollArea
          className={cn("w-full", !activeJob && "kanban-board-snap")}
          type="scroll"
        >
          <div
            ref={columnsRef}
            className={cn("flex gap-3 py-1 mx-[2px]", !activeJob && "cursor-grab active:cursor-grabbing")}
            style={{ height: boardHeight }}
            onMouseDown={handleMouseDown}
          >
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                jobs={getStageJobs(stage.name)}
                onJobClick={onJobClick}
                onAddJob={onAddJob}
                cardView={cardView}
                visibleFields={visibleFields}
                members={members}
                onAssigneeChange={inlineEditing ? onAssigneeChange : undefined}
                onJobFieldChange={inlineEditing ? onJobFieldChange : undefined}
                highlightJobId={flashId}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-2 [&>div]:bg-muted-foreground/30 hover:[&>div]:bg-muted-foreground/50" />
        </ScrollArea>

        {activeJob && canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 flex w-10 items-center justify-center bg-gradient-to-r from-background/90 to-transparent motion-appear">
            <IconChevronLeft className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {activeJob && canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 flex w-10 items-center justify-center bg-gradient-to-l from-background/90 to-transparent motion-appear">
            <IconChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeJob ? (
          <div className="w-[290px] p-2">
            {cardView === "compact" ? (
              <KanbanCardCompact
                job={activeJob}
                onClick={() => {}}
                isOverlay
                visibleFields={visibleFields}
              />
            ) : (
              <KanbanCard job={activeJob} onClick={() => {}} isOverlay visibleFields={visibleFields} />
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
