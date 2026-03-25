"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { KanbanCardCompact } from "./kanban-card-compact";
import { updateJobStatus } from "@/actions/jobs";
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
}

export function KanbanBoard({
  jobs,
  stages,
  onJobClick,
  onStatusChange,
  onAddJob,
  cardView = "default",
}: KanbanBoardProps) {
  const [localJobs, setLocalJobs] = useState<JobCardData[]>(jobs);
  const [activeJob, setActiveJob] = useState<JobCardData | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync from parent when jobs change
  if (jobs !== localJobs && !activeJob) {
    setLocalJobs(jobs);
  }

  const checkScroll = useCallback(() => {
    // The Radix ScrollArea viewport is the first child div with data-radix-scroll-area-viewport
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;
    const { scrollLeft, scrollWidth, clientWidth } = viewport;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  // Check scroll state on mount, resize, and when dragging starts
  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll, stages.length]);

  // Re-check scroll when drag starts and on scroll
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

  // Grab-to-scroll: click and drag on empty space to scroll horizontally
  const isDraggingScroll = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);

  function getViewport() {
    return scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Don't grab-scroll while dragging a card (conflicts with dnd-kit)
    if (activeJob) return;
    // Only grab-scroll on left click and when not clicking a card or interactive element
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // [role="button"] catches dnd-kit draggable cards before they have data-dragging
    if (target.closest('[data-dragging], [role="button"], button, a, input, [data-radix-scroll-area-scrollbar], [data-radix-scroll-area-thumb]')) return;

    const viewport = getViewport();
    if (!viewport) return;

    // Only activate if there's overflow (scrollable)
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
    // Cancel any grab-to-scroll that started before dnd-kit activated
    if (isDraggingScroll.current) {
      isDraggingScroll.current = false;
      document.body.style.cursor = "";
    }
    const job = event.active.data.current?.job as JobCardData | undefined;
    if (job) setActiveJob(job);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null);

    const { active, over } = event;
    if (!over) return;

    const jobId = active.id as string;
    const newStatus = over.id as string;
    const job = localJobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;

    const targetStage = stages.find((s) => s.name === newStatus);

    // Optimistic update
    const previousJobs = [...localJobs];
    setLocalJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)),
    );

    const result = await updateJobStatus(jobId, newStatus);
    if (result.error) {
      // Revert
      setLocalJobs(previousJobs);
      toast.error(result.error);
    } else {
      toast.success(
        `Job moved to ${targetStage?.label ?? newStatus}`,
      );
      onStatusChange();
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative" ref={scrollRef}>
        <ScrollArea className="w-full" style={{ minHeight: "73vh" }}>
          <div className={cn("flex gap-4", !activeJob && "cursor-grab active:cursor-grabbing")} style={{ minHeight: "73vh" }} onMouseDown={handleMouseDown}>
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                jobs={localJobs.filter((j) => j.status === stage.name)}
                onJobClick={onJobClick}
                onAddJob={onAddJob}
                cardView={cardView}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-3 [&>div]:bg-muted-foreground/40 hover:[&>div]:bg-muted-foreground/60" />
        </ScrollArea>

        {/* Scroll indicators during drag — hidden when at edge */}
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
          <div className="w-[280px]">
            {cardView === "compact" ? (
              <KanbanCardCompact
                job={activeJob}
                onClick={() => {}}
                isOverlay
              />
            ) : (
              <KanbanCard job={activeJob} onClick={() => {}} isOverlay />
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
