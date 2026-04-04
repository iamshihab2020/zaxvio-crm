"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  IconTrash,
  IconArrowRight,
  IconLayoutSidebar,
  IconMaximize,
  IconChevronDown,
  IconExternalLink,
  IconX,
} from "@tabler/icons-react";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  type JobPriority,
} from "@/lib/constants/job-options";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { getJob, updateJob, updateJobStatus } from "@/actions/jobs";
import { EditableText, EditableSelect } from "@/components/reusable/editable-field";
import { JobDetailInfo } from "./job-detail-info";
import { JobDetailLineItems } from "./job-detail-line-items";
import { JobDetailChecklist } from "./job-detail-checklist";
import { JobDetailPhotos } from "./job-detail-photos";
import { JobDetailActivities } from "./job-detail-activities";

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

import { useViewPreference } from "@/hooks/use-view-preference";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;
const MAX_WIDTH = 800;

const TAB_VALUES = [
  "details",
  "line-items",
  "checklist",
  "photos",
  "activity",
] as const;

const PRIORITY_OPTIONS = Object.entries(JOB_PRIORITY_LABELS).map(([value, label]) => ({
  value,
  label: label as string,
}));

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
  onDelete,
  onStatusChange,
  onJobUpdate,
  stages,
}: JobDetailSheetProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const { mode: prefMode, sidebarWidth: prefSidebarWidth, mounted, setMode: setPrefMode, setSidebarWidth: setPrefSidebarWidth } = useViewPreference("jobs");
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(DEFAULT_WIDTH);
  const switchingModeRef = useRef(false);

  useEffect(() => {
    setLiveSidebarWidth(prefSidebarWidth);
  }, [prefSidebarWidth]);

  useEffect(() => {
    if (!jobId || !open) {
      setJob(null);
      return;
    }
    setLoading(true);
    setActiveTab("details");
    getJob(jobId).then((res) => {
      if (res.data) setJob(res.data as JobDetail);
      setLoading(false);
    });
  }, [jobId, open]);

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

  async function refreshDetail() {
    if (!jobId) return;
    const res = await getJob(jobId);
    if (res.data) setJob(res.data as JobDetail);
  }

  /* ── Inline field save ───────────────────────────────────── */
  const handleFieldSave = useCallback(async (field: string, value: string) => {
    if (!job) return;

    // Optimistic update
    setJob((prev) => prev ? { ...prev, [field]: value || null } : prev);

    const result = await updateJob(job.id, { [field]: value || undefined });
    if (result.error) {
      toast.error(result.error);
      refreshDetail(); // revert
    } else {
      refreshDetail();
      onJobUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, onJobUpdate]);

  /* ── Mode toggle ──────────────────────────────────────────── */
  function toggleMode() {
    switchingModeRef.current = true;
    const newMode = prefMode === "sidebar" ? "dialog" : "sidebar";
    setPrefMode(newMode);
    requestAnimationFrame(() => {
      switchingModeRef.current = false;
    });
  }

  function handleOpenChange(newOpen: boolean) {
    if (switchingModeRef.current) return;
    onOpenChange(newOpen);
  }

  /* ── Drag-to-resize (sidebar only) ────────────────────────── */
  const dragWidthRef = useRef(DEFAULT_WIDTH);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragWidthRef.current = liveSidebarWidth;

      const onMove = (ev: MouseEvent) => {
        const w = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, window.innerWidth - ev.clientX),
        );
        dragWidthRef.current = w;
        setLiveSidebarWidth(w);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setPrefSidebarWidth(dragWidthRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [liveSidebarWidth, setPrefSidebarWidth],
  );

  /* ── Derived values ───────────────────────────────────────── */
  const currentStage = job ? stages.find((s) => s.name === job.status) : null;
  const statusColors = currentStage ? getStageColors(currentStage.color) : null;
  const statusLabel = currentStage?.label ?? job?.status ?? "";
  const priorityColors = job ? JOB_PRIORITY_COLORS[job.priority] : null;

  const currentIndex = currentStage ? stages.findIndex((s) => s.id === currentStage.id) : -1;
  const nextStage = currentIndex >= 0 && currentIndex < stages.length - 1
    ? stages[currentIndex + 1]
    : null;
  const otherStages = stages.filter(
    (s) => s.name !== job?.status && s.name !== nextStage?.name,
  );

  const mode = mounted ? (prefMode === "page" ? "sidebar" : prefMode) : "sidebar";

  function tabLabel(value: string): string {
    if (!job) return value;
    switch (value) {
      case "details":
        return "Details";
      case "line-items":
        return `Line Items (${job.lineItems.length})`;
      case "checklist":
        return `Checklist (${job.checklist.length})`;
      case "photos":
        return `Photos (${job.photoCount})`;
      case "activity":
        return "Activity";
      default:
        return value;
    }
  }

  /* ── Shared inner content ─────────────────────────────────── */
  const innerContent = (
    <>
      {loading && (
        <>
          <SheetTitle className="sr-only">Job details</SheetTitle>
          <SheetDescription className="sr-only">
            Loading job information
          </SheetDescription>
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </>
      )}

      {!loading && job && (
        <>
          {/* ── Header ────────────────────────────────────── */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between pr-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <SheetTitle className="font-heading text-lg shrink-0">
                    {job.jobNumber}
                  </SheetTitle>
                  <Badge className={cn("px-2 py-0.5 font-medium shrink-0", statusColors?.bg, statusColors?.text)}>
                    {statusLabel}
                  </Badge>
                  {/* Editable priority badge */}
                  <EditableSelect
                    value={job.priority}
                    options={PRIORITY_OPTIONS}
                    onSave={(v) => handleFieldSave("priority", v)}
                    renderValue={(val) => {
                      const colors = JOB_PRIORITY_COLORS[val as JobPriority];
                      return (
                        <Badge className={cn("px-2 py-0.5 font-medium cursor-pointer", colors?.bg, colors?.text)}>
                          {JOB_PRIORITY_LABELS[val as JobPriority] ?? val}
                        </Badge>
                      );
                    }}
                  />
                </div>
                {/* Editable title */}
                <SheetDescription asChild>
                  <div>
                    <EditableText
                      value={job.title}
                      onSave={(v) => handleFieldSave("title", v)}
                      placeholder="Job title"
                      className="text-sm font-body"
                    />
                  </div>
                </SheetDescription>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={toggleMode}
                  title={
                    mode === "sidebar"
                      ? "Switch to dialog view"
                      : "Switch to sidebar view"
                  }
                >
                  {mode === "sidebar" ? (
                    <IconMaximize className="h-4 w-4" />
                  ) : (
                    <IconLayoutSidebar className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => {
                    setPrefMode("page");
                    onOpenChange(false);
                    router.push(`/jobs/${job.id}`);
                  }}
                  title="Open full page"
                >
                  <IconExternalLink className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                  onClick={() => onDelete(job)}
                  title="Delete job"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onOpenChange(false)}
                  title="Close"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status action buttons */}
            {stages.length > 1 && (
              <div className="flex gap-2 pt-2">
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
              </div>
            )}
          </div>

          {/* ── Tabs ───────────────────────────────────────── */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
            <TabsList className="w-full justify-start px-6 pt-2">
              {TAB_VALUES.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {tabLabel(value)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="px-6 py-4">
              <TabsContent value="details" className="mt-0">
                <JobDetailInfo job={job} onFieldSave={handleFieldSave} />
              </TabsContent>
              <TabsContent value="line-items" className="mt-0">
                <JobDetailLineItems
                  jobId={job.id}
                  lineItems={job.lineItems}
                  onUpdate={refreshDetail}
                />
              </TabsContent>
              <TabsContent value="checklist" className="mt-0">
                <JobDetailChecklist
                  jobId={job.id}
                  checklist={job.checklist}
                  onUpdate={refreshDetail}
                />
              </TabsContent>
              <TabsContent value="photos" className="mt-0">
                <JobDetailPhotos jobId={job.id} />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <JobDetailActivities jobId={job.id} />
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </>
  );

  if (mode === "dialog") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-0"
        style={{
          maxWidth: mounted ? liveSidebarWidth : DEFAULT_WIDTH,
          width: "100%",
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
          onMouseDown={handleDragStart}
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-brand/40 transition-colors" />
        </div>
        {innerContent}
      </SheetContent>
    </Sheet>
  );
}
