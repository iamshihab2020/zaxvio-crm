"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KanbanCard, type JobCardData } from "./kanban-card";
import { KanbanCardCompact } from "./kanban-card-compact";
import type { CardFieldVisibility } from "./card-fields-popover";
import type { AssigneeMember } from "./assignee-picker";
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
  visibleFields?: CardFieldVisibility;
  members?: AssigneeMember[];
  onAssigneeChange?: (jobId: string, assigneeId: string | null) => void;
  onJobFieldChange?: (jobId: string, field: string, value: string) => void;
}

export function KanbanColumn({
  stage,
  jobs,
  onJobClick,
  onAddJob,
  cardView = "default",
  visibleFields,
  members,
  onAssigneeChange,
  onJobFieldChange,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.name,
    data: { type: "column", stageName: stage.name },
  });

  const colors = getStageColors(stage.color);
  const jobIds = jobs.map((j) => j.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-t-[3px] p-3 transition-all duration-200 min-w-[290px] flex-1",
        "bg-card/60 dark:bg-muted/10",
        colors.borderTop,
        isOver
          ? `${colors.bg} ring-2 ${colors.ring}`
          : "border-border dark:border-border/30",
      )}
    >
      {/* Column header */}
      <div className={cn("mb-3 flex items-center gap-2.5 shrink-0 rounded-lg px-2.5 py-1.5 -mx-0.5", colors.bg)}>
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
        <h3 className={cn("text-[11px] font-bold uppercase tracking-widest font-heading flex-1", colors.text)}>
          {stage.label}
        </h3>
        <span className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
          colors.dot, "text-white",
        )}>
          {jobs.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAddJob(stage.name)}
          className={cn("h-6 w-6", colors.text, "opacity-60 hover:opacity-100")}
          hoverScale={1}
          tapScale={0.9}
          title={`Add job to ${stage.label}`}
        >
          <IconPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Cards */}
      <div
        className="flex-1 overflow-y-auto kanban-column-scroll px-1"
        style={{ maxHeight: "calc(100vh - 12.5rem - 60px)" }}
      >
        <SortableContext items={jobIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: index * 0.04,
                  ease: "easeOut",
                }}
              >
                {cardView === "compact" ? (
                  <KanbanCardCompact job={job} onClick={onJobClick} visibleFields={visibleFields} />
                ) : (
                  <KanbanCard
                    job={job}
                    onClick={onJobClick}
                    visibleFields={visibleFields}
                    members={members}
                    onAssigneeChange={onAssigneeChange}
                    onJobFieldChange={onJobFieldChange}
                  />
                )}
              </motion.div>
            ))}

            {jobs.length === 0 && !isOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center rounded-xl py-10 px-4 text-center"
              >
                <IconBriefcase className="h-7 w-7 text-muted-foreground/40 dark:text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground/70 dark:text-muted-foreground/60 font-body">
                  No jobs in {stage.label}
                </p>
                <p className="text-xs text-muted-foreground/50 dark:text-muted-foreground/40 font-body mt-0.5">
                  Drag a job here or click + to add one
                </p>
              </motion.div>
            )}

            {/* Drop indicator for empty columns */}
            {jobs.length === 0 && isOver && (
              <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand/5 dark:bg-brand/10 py-8 text-center">
                <p className="text-xs text-brand/70 font-body">Drop here</p>
              </div>
            )}

            {/* Add card button */}
            <Button
              variant="ghost"
              size="sm"
              hoverScale={1}
              tapScale={0.97}
              onClick={() => onAddJob(stage.name)}
              className="w-full h-8 text-xs text-muted-foreground/70 dark:text-muted-foreground/60 hover:text-brand font-body rounded-lg hover:bg-muted/40 dark:hover:bg-muted/30"
            >
              <IconPlus className="h-3 w-3 mr-1" />
              Add Job
            </Button>
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
