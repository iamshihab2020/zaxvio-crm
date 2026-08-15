"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  IconChevronRight,
  IconArrowRight,
  IconChevronDown,
  IconDots,
  IconTrash,
} from "@tabler/icons-react";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
} from "@/lib/constants/job-options";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { updateJobStatus, deleteJob } from "@/actions/jobs";
import type { JobDetail } from "./job-detail-sheet";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface JobDetailPageHeaderProps {
  job: JobDetail;
  stages: PipelineStage[];
  onUpdate: () => void;
  children?: React.ReactNode;
}

export function JobDetailPageHeader({
  job,
  stages,
  onUpdate,
  children,
}: JobDetailPageHeaderProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentStage = stages.find((s) => s.name === job.status);
  const statusColors = currentStage ? getStageColors(currentStage.color) : null;
  const statusLabel = currentStage?.label ?? job.status;
  const priorityColors = JOB_PRIORITY_COLORS[job.priority];

  const currentIndex = currentStage
    ? stages.findIndex((s) => s.id === currentStage.id)
    : -1;
  const nextStage =
    currentIndex >= 0 && currentIndex < stages.length - 1
      ? stages[currentIndex + 1]
      : null;
  const otherStages = stages.filter(
    (s) => s.name !== job.status && s.name !== nextStage?.name,
  );

  async function handleStatusAction(newStatus: string) {
    const targetStage = stages.find((s) => s.name === newStatus);
    const result = await updateJobStatus(job.id, newStatus);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Job moved to ${targetStage?.label ?? newStatus}`);
      onUpdate();
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const result = await deleteJob(job.id);
    setDeleteLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Job deleted");
      setDeleteOpen(false);
      router.push("/jobs");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: breadcrumb + job info */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 text-sm font-body">
            <Link
              href="/jobs"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Jobs
            </Link>
            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
          </nav>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground font-heading text-sm">
                {job.jobNumber}
              </span>
              {statusColors && (
                <Badge className={cn("px-2 py-0.5 font-medium", statusColors.bg, statusColors.text)}>
                  {statusLabel}
                </Badge>
              )}
              {priorityColors && (
                <Badge className={cn("px-2 py-0.5 font-medium", priorityColors.bg, priorityColors.text)}>
                  {JOB_PRIORITY_LABELS[job.priority]}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-body">
              {job.title}
            </p>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          {children}
          {nextStage && (
            <Button
              size="sm"
              onClick={() => handleStatusAction(nextStage.name)}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              <IconArrowRight className="mr-1.5 h-3.5 w-3.5" />
              Move to {nextStage.label}
            </Button>
          )}

          {otherStages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="cursor-pointer">
                  More
                  <IconChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {otherStages.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => handleStatusAction(s.name)}
                    className="cursor-pointer"
                  >
                    <span
                      className={cn(
                        "mr-2 h-2 w-2 rounded-full",
                        getStageColors(s.color).dot,
                      )}
                    />
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
              >
                <IconDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete Job
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DeleteConfirmDialog
        entityName="Job"
        itemLabel={job.jobNumber}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleteLoading}
        description="All line items, checklist data, and photos will also be deleted."
      />
    </>
  );
}
