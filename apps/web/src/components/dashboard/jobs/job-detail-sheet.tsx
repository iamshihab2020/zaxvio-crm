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
import { toast } from "sonner";
import {
  IconEdit,
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
  type ServiceType,
} from "@/lib/constants/job-options";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { getJob, updateJobStatus } from "@/actions/jobs";
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
  serviceType: ServiceType;
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
  onEdit: (job: JobDetail) => void;
  onDelete: (job: JobDetail) => void;
  onStatusChange: () => void;
  stages: PipelineStage[];
}

import { useViewPreference } from "@/hooks/use-view-preference";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;
const MAX_WIDTH = 800;

/* ── Tab definitions ─────────────────────────────────────────── */

const TAB_VALUES = [
  "details",
  "line-items",
  "checklist",
  "photos",
  "activity",
] as const;

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
  stages,
}: JobDetailSheetProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  /* ── Preferences ──────────────────────────────────────────── */
  const { mode: prefMode, sidebarWidth: prefSidebarWidth, mounted, setMode: setPrefMode, setSidebarWidth: setPrefSidebarWidth } = useViewPreference("jobs");
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(DEFAULT_WIDTH);
  const switchingModeRef = useRef(false);

  useEffect(() => {
    setLiveSidebarWidth(prefSidebarWidth);
  }, [prefSidebarWidth]);

  /* ── Job data fetching ────────────────────────────────────── */
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

  /* ── Mode toggle ──────────────────────────────────────────── */
  function toggleMode() {
    switchingModeRef.current = true;
    const newMode = prefMode === "sidebar" ? "dialog" : "sidebar";
    setPrefMode(newMode);
    setIndicatorReady(false);
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
    [liveSidebarWidth],
  );

  /* ── Sliding tab indicator ────────────────────────────────── */
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);

  const activeTabIndex = TAB_VALUES.indexOf(
    activeTab as (typeof TAB_VALUES)[number],
  );
  const targetIndex = hoveredIndex ?? activeTabIndex;

  const updateIndicatorTo = useCallback(
    (index: number) => {
      const el = tabRefs.current[index];
      const navEl = navRef.current;
      if (el && navEl) {
        const navRect = navEl.getBoundingClientRect();
        const tabRect = el.getBoundingClientRect();
        setIndicator({
          left: tabRect.left - navRect.left + navEl.scrollLeft,
          width: tabRect.width,
        });
        if (!indicatorReady) setIndicatorReady(true);
      }
    },
    [indicatorReady],
  );

  // Recalculate indicator on target change or mode switch
  useEffect(() => {
    if (targetIndex >= 0 && !loading && job) {
      const id = requestAnimationFrame(() => updateIndicatorTo(targetIndex));
      return () => cancelAnimationFrame(id);
    }
  }, [targetIndex, updateIndicatorTo, loading, job, prefMode]);

  // Recalculate on window resize
  useEffect(() => {
    const onResize = () => {
      if (targetIndex >= 0) updateIndicatorTo(targetIndex);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [targetIndex, updateIndicatorTo]);

  /* ── Derived values ───────────────────────────────────────── */
  const currentStage = job ? stages.find((s) => s.name === job.status) : null;
  const statusColors = currentStage ? getStageColors(currentStage.color) : null;
  const statusLabel = currentStage?.label ?? job?.status ?? "";
  const priorityColors = job ? JOB_PRIORITY_COLORS[job.priority] : null;

  // Next stage = the one after current in sort order, plus other stages in dropdown
  const currentIndex = currentStage ? stages.findIndex((s) => s.id === currentStage.id) : -1;
  const nextStage = currentIndex >= 0 && currentIndex < stages.length - 1
    ? stages[currentIndex + 1]
    : null;
  const otherStages = stages.filter(
    (s) => s.name !== job?.status && s.name !== nextStage?.name,
  );

  const mode = mounted ? (prefMode === "page" ? "sidebar" : prefMode) : "sidebar";

  /* ── Tab labels with counts ────────────────────────────────── */
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
  // SheetTitle/SheetDescription are DialogPrimitive.Title/Description,
  // so they work inside both Sheet and Dialog contexts.
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
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SheetTitle className="font-heading text-lg">
                    {job.jobNumber}
                  </SheetTitle>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      statusColors?.bg,
                      statusColors?.text,
                    )}
                  >
                    {statusLabel}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      priorityColors?.bg,
                      priorityColors?.text,
                    )}
                  >
                    {JOB_PRIORITY_LABELS[job.priority]}
                  </span>
                </div>
                <SheetDescription className="text-sm font-body">
                  {job.title}
                </SheetDescription>
              </div>

              <div className="flex items-center gap-1">
                {/* Mode toggle */}
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

                {/* Open full page */}
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

                {/* Edit */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onEdit(job)}
                  title="Edit job"
                >
                  <IconEdit className="h-4 w-4" />
                </Button>

                {/* Delete */}
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

          {/* ── Tabs with sliding indicator ───────────────── */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
            <TabsList
              ref={navRef}
              className="relative w-full justify-start rounded-none border-b border-border bg-transparent px-6 pt-2"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Sliding indicator */}
              <div
                className={cn(
                  "absolute bottom-0 h-[2px] bg-brand",
                  indicatorReady
                    ? "transition-all duration-300 ease-in-out"
                    : "",
                )}
                style={{ left: indicator.left, width: indicator.width }}
              />
              {TAB_VALUES.map((value, i) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  className="cursor-pointer border-b-0 data-[state=active]:border-transparent"
                >
                  {tabLabel(value)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="px-6 py-4">
              <TabsContent value="details" className="mt-0">
                <JobDetailInfo job={job} />
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

  /* ── Render: Dialog mode ──────────────────────────────────── */
  if (mode === "dialog") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  /* ── Render: Sidebar mode (default) ───────────────────────── */
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
        {/* Drag handle — left edge resize */}
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
