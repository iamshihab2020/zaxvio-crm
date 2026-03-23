"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { updateJobStatus } from "@/actions/jobs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
}

export function KanbanBoard({
  jobs,
  stages,
  onJobClick,
  onStatusChange,
  onAddJob,
}: KanbanBoardProps) {
  const [localJobs, setLocalJobs] = useState<JobCardData[]>(jobs);
  const [activeJob, setActiveJob] = useState<JobCardData | null>(null);

  // Sync from parent when jobs change
  if (jobs !== localJobs && !activeJob) {
    setLocalJobs(jobs);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              jobs={localJobs.filter((j) => j.status === stage.name)}
              onJobClick={onJobClick}
              onAddJob={onAddJob}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay dropAnimation={null}>
        {activeJob ? (
          <div className="w-[264px] rotate-2 scale-[1.03]">
            <KanbanCard job={activeJob} onClick={() => {}} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
