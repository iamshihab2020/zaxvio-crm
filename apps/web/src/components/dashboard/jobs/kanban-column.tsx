"use client";

import { useDroppable } from "@dnd-kit/core";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
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
        "flex flex-col rounded-xl border p-3 transition-all duration-200 min-w-[290px] flex-1",
        "bg-muted/40 dark:bg-muted/10",
        isOver
          ? `${colors.bg} ring-2 ${colors.ring} border-transparent`
          : "border-border/50 dark:border-border/40",
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
      <div className="flex-1 overflow-y-auto pr-1">
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
                <KanbanCardCompact job={job} onClick={onJobClick} />
              ) : (
                <KanbanCard job={job} onClick={onJobClick} />
              )}
            </motion.div>
          ))}

          {jobs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center rounded-xl py-10 px-4 text-center"
            >
              <IconBriefcase className="h-7 w-7 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground/60 font-body">
                No jobs in {stage.label}
              </p>
              <p className="text-xs text-muted-foreground/40 font-body mt-0.5">
                Drag a job here or click + to add one
              </p>
            </motion.div>
          )}

          {/* Add card button */}
          <button
            onClick={() => onAddJob(stage.name)}
            className="w-full py-2 text-xs text-muted-foreground/60 hover:text-brand font-body transition-colors rounded-lg hover:bg-muted/30"
          >
            <span className="flex items-center justify-center gap-1">
              <IconPlus className="h-3 w-3" />
              Add Job
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
