"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { KanbanCardCompact } from "./kanban-card-compact";
import type { CardFieldVisibility } from "./card-fields-popover";
import { reorderJobs } from "@/actions/jobs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface KanbanBoardProps {
  jobs: JobCardData[];
  stages: PipelineStage[];
  onJobClick: (jobId: string) => void;
  onStatusChange: () => void;
  onAddJob: (stageName: string) => void;
  cardView?: "default" | "compact";
  visibleFields?: CardFieldVisibility;
}

export function KanbanBoard({
  jobs,
  stages,
  onJobClick,
  onStatusChange,
  onAddJob,
  cardView = "default",
  visibleFields,
}: KanbanBoardProps) {
  const [localJobs, setLocalJobs] = useState<JobCardData[]>(jobs);
  const [activeJob, setActiveJob] = useState<JobCardData | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingMoveRef = useRef(false);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    if (isDraggingScroll.current) {
      isDraggingScroll.current = false;
      document.body.style.cursor = "";
    }
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

    // Reorder within the same stage
    if (activeId !== overId && over.data.current?.type !== "column") {
      const oldIndex = stageJobs.findIndex((j) => j.id === activeId);
      const newIndex = stageJobs.findIndex((j) => j.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(stageJobs, oldIndex, newIndex);

        // Optimistic update
        setLocalJobs((prev) => {
          const otherJobs = prev.filter((j) => j.status !== overStage);
          return [...otherJobs, ...reordered];
        });

        // Fire-and-forget persist
        reorderJobs(
          reordered.map((j, i) => ({ id: j.id, sortOrder: i, status: overStage! })),
        );
      }
    }

    // Cross-column move (status change)
    const job = localJobs.find((j) => j.id === activeId);
    const originalJob = jobs.find((j) => j.id === activeId);
    if (job && originalJob && job.status !== originalJob.status) {
      const targetStage = stages.find((s) => s.name === job.status);
      const snapshot = [...localJobs];

      // Block parent sync while API is in flight
      pendingMoveRef.current = true;

      // Persist status + sort order (fire-and-forget with error revert)
      const targetJobs = localJobs.filter((j) => j.status === job.status);
      reorderJobs(
        targetJobs.map((j, i) => ({ id: j.id, sortOrder: i, status: job.status })),
      ).then((result) => {
        pendingMoveRef.current = false;
        if (result.error) {
          setLocalJobs(snapshot);
          toast.error(result.error);
        } else {
          toast.success(`Job moved to ${targetStage?.label ?? job.status}`);
          onStatusChange();
        }
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative" ref={scrollRef}>
        <ScrollArea className="w-full" type="scroll">
          <div
            className={cn("flex gap-3 py-1 mx-[2px]", !activeJob && "cursor-grab active:cursor-grabbing")}
            style={{ height: "calc(100vh - 12.5rem)" }}
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
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-2 [&>div]:bg-muted-foreground/30 hover:[&>div]:bg-muted-foreground/50" />
        </ScrollArea>

        {activeJob && canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 flex w-10 items-center justify-center bg-gradient-to-r from-background/90 to-transparent animate-pulse">
            <IconChevronLeft className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {activeJob && canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 flex w-10 items-center justify-center bg-gradient-to-l from-background/90 to-transparent animate-pulse">
            <IconChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
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
