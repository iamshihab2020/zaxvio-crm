"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { IconPlus } from "@tabler/icons-react";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface KanbanColumnProps {
  stage: PipelineStage;
  jobs: JobCardData[];
  onJobClick: (jobId: string) => void;
  onAddJob: (stageName: string) => void;
}

export function KanbanColumn({ stage, jobs, onJobClick, onAddJob }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.name });

  const colors = getStageColors(stage.color);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border bg-muted/20 p-3 transition-colors min-w-[280px] flex-1 overflow-hidden",
        isOver ? `${colors.bg} ${colors.border}` : "border-border",
      )}
    >
      <div className="mb-3 flex items-center gap-2 shrink-0">
        <span className={cn("h-3 w-3 rounded-full", colors.dot)} />
        <h3 className="text-sm font-semibold text-foreground font-heading">
          {stage.label}
        </h3>
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {jobs.length}
        </span>
        <button
          onClick={() => onAddJob(stage.name)}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          title={`Add job to ${stage.label}`}
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 pr-2">
          {jobs.map((job) => (
            <KanbanCard key={job.id} job={job} onClick={onJobClick} />
          ))}

          {jobs.length === 0 && (
            <div className="flex items-center justify-center rounded-md border border-dashed border-border/60 py-8">
              <p className="text-xs text-muted-foreground font-body">
                No jobs
              </p>
            </div>
          )}

          <button
            onClick={() => onAddJob(stage.name)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 py-2 text-xs text-muted-foreground hover:border-brand/40 hover:text-brand transition-colors cursor-pointer font-body"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Add Job
          </button>
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
