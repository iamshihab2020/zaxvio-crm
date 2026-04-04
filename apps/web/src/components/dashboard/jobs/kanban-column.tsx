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
}

export function KanbanColumn({
  stage,
  jobs,
  onJobClick,
  onAddJob,
  cardView = "default",
  visibleFields,
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
        "flex flex-col rounded-xl border p-3 transition-all duration-200 min-w-[290px] flex-1",
        "bg-muted/20 dark:bg-muted/10",
        isOver
          ? `${colors.bg} ring-2 ${colors.ring} border-transparent`
          : "border-border/40 dark:border-border/30",
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2 shrink-0">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1",
            colors.bg,
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
          <h3 className={cn("text-xs font-semibold uppercase tracking-wider font-heading", colors.text)}>
            {stage.label}
          </h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground font-body">
          {jobs.length}
        </span>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAddJob(stage.name)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            hoverScale={1}
            tapScale={0.9}
            title={`Add job to ${stage.label}`}
          >
            <IconPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
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
                  <KanbanCard job={job} onClick={onJobClick} visibleFields={visibleFields} />
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
