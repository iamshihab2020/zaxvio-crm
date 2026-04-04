"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { IconArrowRight, IconChevronDown } from "@tabler/icons-react";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  type JobPriority,
} from "@/lib/constants/job-options";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { getJob, updateJob, updateJobStatus } from "@/actions/jobs";
import {
  EditableText,
  EditableSelect,
} from "@/components/reusable/editable-field";
import { JobDetailInfo } from "./job-detail-info";
import { JobDetailLineItems } from "./job-detail-line-items";
import { JobDetailChecklist } from "./job-detail-checklist";
import { JobDetailPhotos } from "./job-detail-photos";
import { JobDetailActivities } from "./job-detail-activities";
import { EntityDetailShell } from "@/components/dashboard/reusable/entity-detail-shell";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface JobDetail {
  id: string;
  jobNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: JobPriority;
  serviceType: string;
  scheduledDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  address: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  notes: string | null;
  customerId: string;
  equipmentId: string | null;
  equipmentType: string | null;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: Array<{
    id: string;
    itemType: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string | null;
    catalogItemId: string | null;
    sortOrder: number | null;
  }>;
  checklist: Array<{
    id: string;
    checklistItemId: string;
    isCompleted: boolean;
    completedBy: string | null;
    completedAt: string | null;
    label: string;
    isRequired: boolean;
    catalogItemId: string | null;
    sortOrder: number | null;
    catalogItemName: string | null;
    catalogItemPrice: string | null;
  }>;
  photoCount: number;
}

interface JobDetailSheetProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (job: JobDetail) => void;
  onStatusChange: () => void;
  onJobUpdate: () => void;
  stages: PipelineStage[];
}

const PRIORITY_OPTIONS = Object.entries(JOB_PRIORITY_LABELS).map(
  ([value, label]) => ({
    value,
    label: label as string,
  }),
);

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
  onDelete,
  onStatusChange,
  onJobUpdate,
  stages,
}: JobDetailSheetProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId || !open) {
      setJob(null);
      return;
    }
    setLoading(true);
    getJob(jobId).then((res) => {
      if (res.data) setJob(res.data as JobDetail);
      setLoading(false);
    });
  }, [jobId, open]);

  async function refreshDetail() {
    if (!jobId) return;
    const res = await getJob(jobId);
    if (res.data) setJob(res.data as JobDetail);
  }

  async function handleStatusAction(newStatus: string) {
    if (!job) return;
    const targetStage = stages.find((s) => s.name === newStatus);
    const result = await updateJobStatus(job.id, newStatus);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Job moved to ${targetStage?.label ?? newStatus}`);
      refreshDetail();
      onStatusChange();
    }
  }

  const handleFieldSave = useCallback(
    async (field: string, value: string) => {
      if (!job) return;
      setJob((prev) => (prev ? { ...prev, [field]: value || null } : prev));
      const result = await updateJob(job.id, {
        [field]: value || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        refreshDetail();
      } else {
        refreshDetail();
        onJobUpdate();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job?.id, onJobUpdate],
  );

  /* ── Derived values ───────────────────────────────────────── */
  const currentStage = job
    ? stages.find((s) => s.name === job.status)
    : null;
  const statusColors = currentStage
    ? getStageColors(currentStage.color)
    : null;
  const statusLabel = currentStage?.label ?? job?.status ?? "";

  const currentIndex = currentStage
    ? stages.findIndex((s) => s.id === currentStage.id)
    : -1;
  const nextStage =
    currentIndex >= 0 && currentIndex < stages.length - 1
      ? stages[currentIndex + 1]
      : null;
  const otherStages = stages.filter(
    (s) => s.name !== job?.status && s.name !== nextStage?.name,
  );

  const tabs = useMemo(
    () =>
      job
        ? [
            {
              value: "details",
              label: "Details",
              content: (
                <JobDetailInfo job={job} onFieldSave={handleFieldSave} />
              ),
            },
            {
              value: "line-items",
              label: "Line Items",
              count: job.lineItems.length,
              content: (
                <JobDetailLineItems
                  jobId={job.id}
                  lineItems={job.lineItems}
                  onUpdate={refreshDetail}
                />
              ),
            },
            {
              value: "checklist",
              label: "Checklist",
              count: job.checklist.length,
              content: (
                <JobDetailChecklist
                  jobId={job.id}
                  checklist={job.checklist}
                  onUpdate={refreshDetail}
                />
              ),
            },
            {
              value: "photos",
              label: "Photos",
              count: job.photoCount,
              content: <JobDetailPhotos jobId={job.id} />,
            },
            {
              value: "activity",
              label: "Activity",
              content: <JobDetailActivities jobId={job.id} />,
            },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job, handleFieldSave],
  );

  return (
    <EntityDetailShell
      entityType="jobs"
      entityRoute="/jobs"
      entityLabel="Job"
      entityId={jobId}
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      hasData={!!job}
      onDelete={job ? () => onDelete(job) : undefined}
      renderTitle={() => (
        <>
          <span className="font-heading text-xl tracking-tight">
            {job!.jobNumber}
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge
              className={cn(
                "px-2 py-0.5 font-medium shrink-0",
                statusColors?.bg,
                statusColors?.text,
              )}
            >
              {statusLabel}
            </Badge>
            <EditableSelect
              value={job!.priority}
              options={PRIORITY_OPTIONS}
              onSave={(v) => handleFieldSave("priority", v)}
              renderValue={(val) => {
                const colors = JOB_PRIORITY_COLORS[val as JobPriority];
                return (
                  <Badge
                    className={cn(
                      "px-2 py-0.5 font-medium cursor-pointer",
                      colors?.bg,
                      colors?.text,
                    )}
                  >
                    {JOB_PRIORITY_LABELS[val as JobPriority] ?? val}
                  </Badge>
                );
              }}
            />
          </div>
        </>
      )}
      renderDescription={() => (
        <EditableText
          value={job!.title}
          onSave={(v) => handleFieldSave("title", v)}
          placeholder="Job title"
          className="text-sm font-body"
        />
      )}
      renderActions={
        stages.length > 1
          ? () => (
              <>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                      >
                        More
                        <IconChevronDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
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
              </>
            )
          : undefined
      }
      tabs={tabs}
    />
  );
}
