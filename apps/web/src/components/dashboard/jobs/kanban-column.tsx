"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { KanbanCardCompact } from "./kanban-card-compact";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { IconPlus, IconBriefcase } from "@tabler/icons-react";

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
  cardView?: "default" | "compact";
}

export function KanbanColumn({
  stage,
  jobs,
  onJobClick,
  onAddJob,
  cardView = "default",
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.name });

  const colors = getStageColors(stage.color);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border-t-[3px] border bg-muted/20 p-3 transition-all duration-200 min-w-[280px] flex-1",
        colors.borderTop,
        isOver ? `${colors.bg} ring-2 ${colors.ring}` : "border-border",
      )}
    >
      <div className="mb-3 flex items-center gap-2 shrink-0">
        <span className={cn("h-3 w-3 rounded-full", colors.dot)} />
        <h3 className="text-sm font-semibold text-foreground font-heading">
          {stage.label}
        </h3>
        <span
          className={cn(
            "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium",
            colors.bg,
            colors.text,
          )}
        >
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

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          {jobs.map((job, index) => (
            <div
              key={job.id}
              className="animate-card-enter"
              style={
                { "--enter-delay": `${index * 50}ms` } as React.CSSProperties
              }
            >
              {cardView === "compact" ? (
                <KanbanCardCompact job={job} onClick={onJobClick} />
              ) : (
                <KanbanCard job={job} onClick={onJobClick} />
              )}
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 py-10 px-4 text-center">
              <IconBriefcase className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground font-body">
                No jobs in {stage.label}
              </p>
              <p className="text-xs text-muted-foreground/70 font-body mt-1">
                Drag a job here or click + to add one
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
      </div>
    </div>
  );
}
