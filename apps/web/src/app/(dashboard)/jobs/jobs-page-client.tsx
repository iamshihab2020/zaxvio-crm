"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useViewPreference } from "@/hooks/use-view-preference";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import {
  useBulkDeleteJobs,
  useBulkArchiveJobs,
  useBulkRestoreJobs,
  useBulkUpdateJobStatus,
} from "@/hooks/queries";
const KanbanBoard = dynamic(
  () =>
    import("@/components/dashboard/jobs/kanban-board").then((m) => ({
      default: m.KanbanBoard,
    })),
  { ssr: false, loading: () => <KanbanSkeleton columnCount={4} /> }
);
import { KanbanSkeleton } from "@/components/dashboard/jobs/kanban-skeleton";
import { JobFilters } from "@/components/dashboard/jobs/job-filters";
import { JobListView } from "@/components/dashboard/jobs/job-list-view";
import {
  JobDetailSheet,
  type JobDetail,
} from "@/components/dashboard/jobs/job-detail-sheet";
import {
  JobCreateDialog,
  type JobFormData,
} from "@/components/dashboard/jobs/job-create-dialog";
import { PipelineStagesDialog } from "@/components/dashboard/jobs/pipeline-stages-dialog";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  DisplaySettingsPopover,
  useCardFieldVisibility,
} from "@/components/dashboard/jobs/card-fields-popover";
import type { JobCardData } from "@/components/dashboard/jobs/kanban-card";
import {
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  addJobLineItem,
  getJobAssignees,
} from "@/actions/jobs";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import type { AssigneeMember } from "@/components/dashboard/jobs/assignee-picker";
import { getPipelines } from "@/actions/pipelines";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { getTenant } from "@/actions/tenants";
import { PipelineTabs } from "@/components/dashboard/jobs/pipeline-tabs";
import { JobTable } from "@/components/dashboard/jobs/job-table";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { Button } from "@/components/ui/button";
import {
  IconLayoutKanban,
  IconListDetails,
  IconList,
  IconPlus,
  IconStatusChange,
  IconTrash,
  IconArchive,
  IconArchiveOff,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/reusable/page-header";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { cn } from "@/lib/utils";
import {
  Highlight,
  HighlightItem,
} from "@/components/animate-ui/primitives/effects/highlight";
import type { JobPriority, ServiceType } from "@/lib/constants/job-options";

interface PipelineData {
  id: string;
  name: string;
  label: string;
  isDefault: boolean;
  stageCount: number;
  jobCount: number;
}

interface PipelineStageWithCount {
  id: string;
  pipelineId: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  jobCount: number;
}

interface JobsPageClientProps {
  initialPipelines?: PipelineData[];
  initialJobs?: unknown[];
  initialStages?: unknown[];
  initialPipelineId?: string | null;
  defaultTaxRate?: string;
}

export function JobsPageClient({
  initialPipelines = [],
  initialJobs = [],
  initialStages = [],
  initialPipelineId = null,
  defaultTaxRate: prefetchedTaxRate,
}: JobsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("jobs");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(() => {
    if (typeof window === "undefined") return initialPipelineId;
    const urlPipeline = new URLSearchParams(window.location.search).get("pipeline");
    if (urlPipeline) return urlPipeline;
    const stored = localStorage.getItem("jobs-pipeline-id");
    if (stored) return stored;
    return initialPipelineId;
  });
  const hasServerData = initialPipelineId !== null && initialPipelines.length > 0;
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedPriority = useDebouncedValue(priorityFilter, 300);
  const debouncedServiceType = useDebouncedValue(serviceTypeFilter, 300);

  // View type: board vs list vs table (persisted — SSR-safe default)
  const [viewType, setViewType] = useState<"board" | "list" | "table">("board");
  // Compact density (persisted — SSR-safe default)
  const [compact, setCompact] = useState(false);

  // Hydrate localStorage preferences after mount
  useEffect(() => {
    const storedType = localStorage.getItem("jobs-view-type");
    if (storedType === "table" || storedType === "list") {
      setViewType(storedType);
    } else {
      const legacy = localStorage.getItem("jobs-view-mode");
      if (legacy === "table") setViewType("table");
    }
    const storedCompact = localStorage.getItem("jobs-compact");
    if (storedCompact === "true") {
      setCompact(true);
    } else {
      const legacyCompact = localStorage.getItem("jobs-view-mode") ?? localStorage.getItem("jobs-card-view");
      if (legacyCompact === "compact") setCompact(true);
    }
  }, []);

  // Table-specific state
  const [tablePage, setTablePage] = useState(1);
  const [tableSortBy, setTableSortBy] = useState("scheduledDate");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("asc");

  // Bulk selection (table view only)
  const {
    selectedIds,
    toggle: toggleSelect,
    toggleAll: toggleSelectAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);

  // Active vs Archived view (table view only)
  const [viewFilter, setViewFilter] = useState("");
  const showingArchived = viewFilter === "archived";

  function handleViewTypeChange(type: "board" | "list" | "table") {
    setViewType(type);
    localStorage.setItem("jobs-view-type", type);
  }

  function handleCompactChange(value: boolean) {
    setCompact(value);
    localStorage.setItem("jobs-compact", String(value));
  }

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handledJobIdParam = useRef(false);
  const pipelineChangingRef = useRef(false);
  useEffect(() => {
    const jobIdParam = searchParams.get("jobId");
    if (jobIdParam && !handledJobIdParam.current) {
      handledJobIdParam.current = true;
      setSelectedJobId(jobIdParam);
      setSheetOpen(true);
    }
  }, [searchParams]);

  // Create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobDetail | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJob, setDeletingJob] = useState<JobDetail | null>(null);

  // Pipeline dialog
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);

  // Initial status for column-specific job creation
  const [initialStatus, setInitialStatus] = useState<string | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);

  // Card field visibility customization
  const { fields: cardFields, setField: setCardField, resetDefaults: resetCardFields } = useCardFieldVisibility();

  // ── Queries ────────────────────────────────────────────────

  // Pipelines
  const pipelinesQuery = useQuery({
    queryKey: queryKeys.pipelines.list(),
    queryFn: async () => {
      const result = await getPipelines();
      return (result.data ?? []) as PipelineData[];
    },
    initialData: initialPipelines.length > 0 ? initialPipelines : undefined,
    staleTime: 30_000,
  });
  const pipelinesData = pipelinesQuery.data ?? [];

  // Resolve pipeline ID from URL/localStorage/default when pipelines load (only once)
  const pipelineResolved = useRef(initialPipelines.length > 0);
  useEffect(() => {
    if (pipelineResolved.current) return;
    if (pipelinesData.length === 0) return;
    pipelineResolved.current = true;

    const urlPipeline = searchParams.get("pipeline");
    const storedPipeline = typeof window !== "undefined"
      ? localStorage.getItem("jobs-pipeline-id")
      : null;

    let resolvedId: string | null = null;
    if (urlPipeline && pipelinesData.some((p) => p.id === urlPipeline)) {
      resolvedId = urlPipeline;
    } else if (storedPipeline && pipelinesData.some((p) => p.id === storedPipeline)) {
      resolvedId = storedPipeline;
    } else {
      resolvedId = pipelinesData.find((p) => p.isDefault)?.id ?? pipelinesData[0]?.id ?? null;
    }

    if (resolvedId) {
      setSelectedPipelineId(resolvedId);
      localStorage.setItem("jobs-pipeline-id", resolvedId);
      if (searchParams.get("pipeline") !== resolvedId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pipeline", resolvedId);
        router.replace(`/jobs?${params.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelinesData]);

  // Pipeline stages
  const stagesQuery = useQuery({
    queryKey: queryKeys.pipelines.stages(selectedPipelineId ?? "__none__"),
    queryFn: async () => {
      const result = await getPipelineStages(selectedPipelineId!);
      return (result.data ?? []) as PipelineStageWithCount[];
    },
    enabled: !!selectedPipelineId,
    initialData: initialStages.length > 0 ? (initialStages as PipelineStageWithCount[]) : undefined,
    staleTime: 15_000,
  });
  const stages = stagesQuery.data ?? [];

  // Board/List jobs (all jobs for current pipeline, no pagination)
  const boardJobsParams = {
    search: debouncedSearch || undefined,
    priority: debouncedPriority ?? undefined,
    serviceType: debouncedServiceType ?? undefined,
    pipelineId: selectedPipelineId ?? undefined,
  };
  const boardJobsQuery = useQuery({
    queryKey: queryKeys.jobs.list({ ...boardJobsParams, view: "board" }),
    queryFn: async () => {
      const result = await getJobs({
        ...boardJobsParams,
        limit: 150,
        sortBy: "scheduledDate",
        sortOrder: "asc",
      });
      return (result.data ?? []) as JobCardData[];
    },
    enabled: !!selectedPipelineId,
    initialData: initialJobs.length > 0 ? (initialJobs as JobCardData[]) : undefined,
    staleTime: 10_000,
  });
  const jobs = boardJobsQuery.data ?? [];

  // Table jobs (paginated, separate query)
  const tableJobsParams = {
    search: debouncedSearch || undefined,
    priority: debouncedPriority ?? undefined,
    serviceType: debouncedServiceType ?? undefined,
    pipelineId: selectedPipelineId ?? undefined,
    showArchived: showingArchived || undefined,
    page: tablePage,
    sortBy: tableSortBy,
    sortOrder: tableSortOrder,
  };
  const tableJobsQuery = useQuery({
    queryKey: queryKeys.jobs.list({ ...tableJobsParams, view: "table" }),
    queryFn: async () => {
      const result = await getJobs({
        ...tableJobsParams,
        limit: 15,
      });
      return {
        data: (result.data ?? []) as JobCardData[],
        pagination: result.pagination ?? { page: tablePage, totalPages: 1, total: 0 },
      };
    },
    enabled: !!selectedPipelineId && viewType === "table",
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
  const tableJobs = tableJobsQuery.data?.data ?? [];
  const tablePagination = tableJobsQuery.data?.pagination ?? { page: tablePage, totalPages: 1, total: 0 };
  const tableLoading = tableJobsQuery.isLoading || tableJobsQuery.isFetching;

  // Prefetch next page (table view only)
  useEffect(() => {
    if (viewType === "table" && tablePagination && tablePage < tablePagination.totalPages) {
      const nextPageParams = { ...tableJobsParams, page: tablePage + 1 };
      queryClient.prefetchQuery({
        queryKey: queryKeys.jobs.list({ ...nextPageParams, view: "table" }),
        queryFn: async () => {
          const result = await getJobs({ ...nextPageParams, limit: 15 });
          return {
            data: (result.data ?? []) as JobCardData[],
            pagination: result.pagination ?? { page: tablePage + 1, totalPages: 1, total: 0 },
          };
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePage, tablePagination?.totalPages, viewType]);

  // Assignees
  const assigneesQuery = useQuery({
    queryKey: queryKeys.jobs.assignees(),
    queryFn: async () => {
      const result = await getJobAssignees();
      return (result.data ?? []) as AssigneeMember[];
    },
    staleTime: 60_000,
  });
  const assigneeMembers = assigneesQuery.data ?? [];

  // Tenant tax rate
  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant.settings(),
    queryFn: async () => {
      const result = await getTenant();
      return result.data?.defaultTaxRate as string | undefined;
    },
    enabled: !prefetchedTaxRate,
    initialData: prefetchedTaxRate,
    staleTime: 120_000,
  });
  const defaultTaxRate = tenantQuery.data ?? prefetchedTaxRate;

  // Loading state — show loading only when board/list data is loading (not table)
  const loading = (!hasServerData && boardJobsQuery.isLoading) || !selectedPipelineId;

  // ── Invalidation helpers ──────────────────────────────────

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    if (selectedPipelineId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.stages(selectedPipelineId) });
    }
  }, [queryClient, selectedPipelineId]);

  const invalidateJobsAndStages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    if (selectedPipelineId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.stages(selectedPipelineId) });
    }
  }, [queryClient, selectedPipelineId]);

  // Set pipeline URL param immediately from localStorage (before API call)
  useEffect(() => {
    if (selectedPipelineId && !searchParams.get("pipeline")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pipeline", selectedPipelineId);
      router.replace(`/jobs?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When pipeline changes, reset filters
  const initialFetchSkipped = useRef(initialJobs.length > 0);
  useEffect(() => {
    if (!selectedPipelineId) return;
    if (initialFetchSkipped.current) {
      initialFetchSkipped.current = false;
      return;
    }
    pipelineChangingRef.current = true;
    setSearch("");
    setPriorityFilter(null);
    setServiceTypeFilter(null);
    setTablePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipelineId]);

  function handlePipelineChange(pipelineId: string) {
    setSelectedPipelineId(pipelineId);
    localStorage.setItem("jobs-pipeline-id", pipelineId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("pipeline", pipelineId);
    router.replace(`/jobs?${params.toString()}`);
  }

  // Clear selection when filters or pipeline change
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedPriority, debouncedServiceType, selectedPipelineId, viewFilter]);

  // ── Mutations (reusable hooks — toast + invalidation handled internally) ──

  const bulkDeleteMutation = useBulkDeleteJobs();
  const bulkArchiveMutation = useBulkArchiveJobs();
  const bulkRestoreMutation = useBulkRestoreJobs();
  const bulkStatusMutation = useBulkUpdateJobStatus();

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: (res) => {
        if (!res.error) {
          clearSelection();
          setBulkDeleteOpen(false);
          invalidateJobsAndStages();
        }
      },
    });
  }

  function handleBulkArchive() {
    const mutation = showingArchived ? bulkRestoreMutation : bulkArchiveMutation;
    mutation.mutate(Array.from(selectedIds), {
      onSuccess: (res) => {
        if (!res.error) {
          clearSelection();
          setBulkArchiveOpen(false);
          invalidateJobsAndStages();
        }
      },
    });
  }

  function handleBulkStatusUpdate(status: string) {
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status }, {
      onSuccess: (res) => {
        if (!res.error) {
          clearSelection();
          invalidateAll();
        }
      },
    });
  }

  const bulkLoading = bulkDeleteMutation.isPending || bulkArchiveMutation.isPending || bulkRestoreMutation.isPending || bulkStatusMutation.isPending;

  function handleJobClick(jobId: string) {
    if (viewMode === "page") {
      router.push(`/jobs/${jobId}`);
      return;
    }
    setSelectedJobId(jobId);
    setSheetOpen(true);
  }

  function handleStatusChange() {
    invalidateAll();
  }

  function handleTableSort(column: string) {
    const newOrder = tableSortBy === column && tableSortOrder === "asc" ? "desc" : "asc";
    setTableSortBy(column);
    setTableSortOrder(newOrder);
  }

  function handleTablePageChange(page: number) {
    clearSelection();
    setTablePage(page);
  }

  function openCreateDialog() {
    setEditingJob(null);
    setInitialStatus(undefined);
    setDialogOpen(true);
  }

  function openCreateDialogForStage(stageName: string) {
    setEditingJob(null);
    setInitialStatus(stageName);
    setDialogOpen(true);
  }

  function handleJobUpdate() {
    invalidateAll();
  }

  async function handleJobFieldChange(jobId: string, field: string, value: string) {
    // Optimistic update on board jobs via query cache
    queryClient.setQueryData<JobCardData[]>(
      queryKeys.jobs.list({ ...boardJobsParams, view: "board" }),
      (old) => old?.map((j) => j.id === jobId ? { ...j, [field]: value } : j),
    );
    const result = await updateJob(jobId, { [field]: value });
    if (result.error) {
      toast.error(result.error);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    }
  }

  async function handleAssigneeChange(jobId: string, assigneeId: string | null) {
    // Optimistic update on kanban via query cache
    queryClient.setQueryData<JobCardData[]>(
      queryKeys.jobs.list({ ...boardJobsParams, view: "board" }),
      (old) =>
        old?.map((j) => {
          if (j.id !== jobId) return j;
          const member = assigneeMembers.find((m) => m.id === assigneeId) ?? null;
          return {
            ...j,
            assigneeId: assigneeId,
            assigneeName: member?.name ?? null,
            assigneeImage: member?.image ?? null,
          };
        }),
    );
    const result = await updateJob(jobId, { assigneeId });
    if (result.error) {
      toast.error(result.error);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    }
  }

  function handleDeleteFromSheet(job: JobDetail) {
    setDeletingJob(job);
    setSheetOpen(false);
    setDeleteDialogOpen(true);
  }

  async function handleSave(data: JobFormData) {
    setSaving(true);
    setError(null);
    if (editingJob) {
      const result = await updateJob(editingJob.id, {
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
        serviceType: data.serviceType,
        scheduledDate: data.scheduledDate,
        scheduledStart: data.scheduledStart || undefined,
        scheduledEnd: data.scheduledEnd || undefined,
        address: data.address || undefined,
        taxRate: data.taxRate,
        notes: data.notes || undefined,
        equipmentId: data.equipmentId || null,
      });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setDialogOpen(false);
        toast.success("Job updated");
        invalidateAll();
      }
    } else {
      const result = await createJob({
        customerId: data.customerId,
        title: data.title,
        serviceType: data.serviceType,
        scheduledDate: data.scheduledDate,
        description: data.description || undefined,
        scheduledStart: data.scheduledStart || undefined,
        scheduledEnd: data.scheduledEnd || undefined,
        address: data.address || undefined,
        priority: data.priority,
        taxRate: data.taxRate,
        notes: data.notes || undefined,
        status: data.status || undefined,
        equipmentId: data.equipmentId || undefined,
        pipelineId: selectedPipelineId || undefined,
        assigneeId: data.assigneeId || undefined,
      });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        if (data.lineItems && data.lineItems.length > 0) {
          const jobId = result.data.id;
          await Promise.all(
            data.lineItems.map((li) =>
              addJobLineItem(jobId, {
                description: li.description,
                unitPrice: li.unitPrice,
                itemType: li.itemType,
                quantity: li.quantity,
                catalogItemId: li.catalogItemId ?? undefined,
              }),
            ),
          );
        }
        setDialogOpen(false);
        toast.success("Job created");
        invalidateJobsAndStages();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingJob) return;
    setSaving(true);
    const result = await deleteJob(deletingJob.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Job deleted");
      setDeleteDialogOpen(false);
      setDeletingJob(null);
      invalidateJobsAndStages();
    }
    setSaving(false);
  }

  const showNoResults = !loading && jobs.length === 0 && (!!search || !!priorityFilter || !!serviceTypeFilter);
  const stagesReady = stages.length > 0;

  return (
    <section className="px-5 pt-2.5 pb-0">
      <PageHeader title="Jobs" subtitle="Track and manage all your service jobs." className="mb-2" />
      {/* Unified toolbar */}
      <div className="mb-4 flex items-center rounded-xl border border-border/60 bg-card shadow-sm dark:border-border/40 dark:bg-muted/15 dark:shadow-none px-2 py-1.5">
        {/* Left: Pipeline selector */}
        <PipelineTabs
          pipelines={pipelinesData}
          selectedId={selectedPipelineId}
          onSelect={handlePipelineChange}
          onManageStages={() => setPipelineDialogOpen(true)}
        />

        <div className="h-5 w-px bg-border dark:bg-border/60 mx-2 shrink-0" />

        {/* Left-center: Search + Filter */}
        <JobFilters
          search={search}
          onSearchChange={setSearch}
          priority={priorityFilter}
          onPriorityChange={setPriorityFilter}
          serviceType={serviceTypeFilter}
          onServiceTypeChange={setServiceTypeFilter}
        />

        {/* Center: Board / List / Table switch */}
        <div className="mx-auto">
          <Highlight
            className="rounded-md bg-brand-light dark:bg-brand/20"
            value={viewType}
            controlledItems
          >
            <div className="flex items-center rounded-lg bg-muted/80 dark:bg-muted/30 p-0.5 gap-0.5">
              <HighlightItem value="board">
                <Button
                  variant="ghost"
                  size="sm"
                  hoverScale={1}
                  tapScale={0.97}
                  onClick={() => handleViewTypeChange("board")}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-md px-3 h-6 text-xs font-semibold font-body whitespace-nowrap",
                    viewType === "board"
                      ? "text-brand"
                      : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  <IconLayoutKanban className="h-3.5 w-3.5" />
                  Board
                </Button>
              </HighlightItem>
              <HighlightItem value="list">
                <Button
                  variant="ghost"
                  size="sm"
                  hoverScale={1}
                  tapScale={0.97}
                  onClick={() => handleViewTypeChange("list")}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-md px-3 h-6 text-xs font-semibold font-body whitespace-nowrap",
                    viewType === "list"
                      ? "text-brand"
                      : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  <IconList className="h-3.5 w-3.5" />
                  List
                </Button>
              </HighlightItem>
              <HighlightItem value="table">
                <Button
                  variant="ghost"
                  size="sm"
                  hoverScale={1}
                  tapScale={0.97}
                  onClick={() => handleViewTypeChange("table")}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-md px-3 h-6 text-xs font-semibold font-body whitespace-nowrap",
                    viewType === "table"
                      ? "text-brand"
                      : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  <IconListDetails className="h-3.5 w-3.5" />
                  Table
                </Button>
              </HighlightItem>
            </div>
          </Highlight>
        </div>

        {/* Right: Display settings + New Job */}
        <div className="flex items-center gap-1">
          <DisplaySettingsPopover
            compact={compact}
            onCompactChange={handleCompactChange}
            fields={cardFields}
            onFieldChange={setCardField}
            onFieldsReset={resetCardFields}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewModeMounted={viewMounted}
          />

          <Button
            onClick={openCreateDialog}
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand/90 font-body h-7 text-xs px-2.5 rounded-lg"
          >
            <IconPlus className="mr-1 h-3.5 w-3.5" />
            New Job
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive font-body">
          {error}
        </div>
      )}

      {/* Board view — rendered outside AnimatePresence to avoid transform interference with DnD */}
      {viewType === "board" && (
        <>
          {loading && <KanbanSkeleton columnCount={stages.length || 4} />}

          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No jobs found matching your filters
            </p>
          )}

          {!loading && !stagesReady && !showNoResults && (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground mb-2">No pipeline stages configured</p>
              <Button variant="outline" size="sm" onClick={() => setPipelineDialogOpen(true)}>
                Manage Stages
              </Button>
            </div>
          )}

          {!loading && stagesReady && !showNoResults && (
            <KanbanBoard
              jobs={jobs}
              stages={stages}
              onJobClick={handleJobClick}
              onStatusChange={handleStatusChange}
              onAddJob={openCreateDialogForStage}
              cardView={compact ? "compact" : "default"}
              visibleFields={cardFields}
              members={assigneeMembers}
              onAssigneeChange={handleAssigneeChange}
              onJobFieldChange={handleJobFieldChange}
            />
          )}
        </>
      )}

      {/* List + Table views with AnimatePresence */}
      {viewType !== "board" && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedPipelineId ?? "loading"}-${viewType}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {/* List view */}
            {viewType === "list" && (
              <>
                {loading && <KanbanSkeleton columnCount={1} />}

                {showNoResults && (
                  <p className="py-12 text-center text-sm text-muted-foreground font-body">
                    No jobs found matching your filters
                  </p>
                )}

                {!loading && stagesReady && !showNoResults && (
                  <JobListView
                    jobs={jobs}
                    stages={stages}
                    onJobClick={handleJobClick}
                  />
                )}
              </>
            )}

            {/* Table view */}
            {viewType === "table" && (
              <>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <StatusFilterTabs
                      options={[
                        { value: "", label: "Active" },
                        { value: "archived", label: "Archived" },
                      ]}
                      value={viewFilter}
                      onChange={setViewFilter}
                    />
                  </div>

                  {tableLoading && (
                    <div className="p-4">
                      <TableSkeleton columns={8} rows={10} />
                    </div>
                  )}

                  {!tableLoading && tableJobs.length === 0 && (
                    <p className="py-12 text-center text-sm text-muted-foreground font-body">
                      No jobs found matching your filters
                    </p>
                  )}

                  {!tableLoading && tableJobs.length > 0 && (
                    <JobTable
                      jobs={tableJobs}
                      stages={stages}
                      onRowClick={handleJobClick}
                      sortBy={tableSortBy}
                      sortOrder={tableSortOrder}
                      onSort={handleTableSort}
                      compact={compact}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onToggleSelectAll={() => toggleSelectAll(tableJobs)}
                      isAllSelected={isAllSelected(tableJobs)}
                      isIndeterminate={isIndeterminate(tableJobs)}
                    />
                  )}
                </div>

                {!tableLoading && tableJobs.length > 0 && tablePagination.totalPages > 1 && (
                  <Pagination
                    page={tablePagination.page}
                    totalPages={tablePagination.totalPages}
                    total={tablePagination.total}
                    onPageChange={handleTablePageChange}
                    entityName="job"
                  />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <JobDetailSheet
        jobId={selectedJobId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDelete={handleDeleteFromSheet}
        onStatusChange={handleStatusChange}
        onJobUpdate={handleJobUpdate}
        stages={stages}
      />

      <JobCreateDialog
        job={editingJob}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
        defaultTaxRate={defaultTaxRate}
        initialStatus={initialStatus}
      />

      <DeleteConfirmDialog
        entityName="Job"
        itemLabel={deletingJob?.jobNumber ?? ""}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
      />

      <PipelineStagesDialog
        open={pipelineDialogOpen}
        onOpenChange={setPipelineDialogOpen}
        stages={stages}
        pipelineId={selectedPipelineId}
        onStagesChange={() => {
          if (selectedPipelineId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.stages(selectedPipelineId) });
          }
        }}
      />

      {/* Bulk action bar — only shown in table view */}
      {viewType === "table" && (
        <>
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearSelection}
            loading={bulkLoading}
            actions={
              showingArchived
                ? [
                    {
                      label: "Restore",
                      icon: IconArchiveOff,
                      onClick: () => setBulkArchiveOpen(true),
                    },
                    {
                      label: "Delete permanently",
                      icon: IconTrash,
                      onClick: () => setBulkDeleteOpen(true),
                      variant: "destructive" as const,
                    },
                  ]
                : [
                    ...stages.map((stage) => ({
                      label: stage.label,
                      icon: IconStatusChange,
                      onClick: () => handleBulkStatusUpdate(stage.name),
                      variant: "secondary" as const,
                    })),
                    {
                      label: "Archive",
                      icon: IconArchive,
                      onClick: () => setBulkArchiveOpen(true),
                    },
                    {
                      label: "Delete",
                      icon: IconTrash,
                      onClick: () => setBulkDeleteOpen(true),
                      variant: "destructive" as const,
                    },
                  ]
            }
          />

          <BulkConfirmDialog
            open={bulkDeleteOpen}
            onOpenChange={setBulkDeleteOpen}
            onConfirm={handleBulkDelete}
            loading={bulkLoading}
            title={`Delete ${selectedCount} Job${selectedCount !== 1 ? "s" : ""}?`}
            description={`This will permanently delete ${selectedCount} selected job${selectedCount !== 1 ? "s" : ""} and all related data (line items, photos, checklist completions).`}
            warning="This action cannot be undone."
            confirmLabel="Delete Jobs"
            variant="destructive"
          />

          <BulkConfirmDialog
            open={bulkArchiveOpen}
            onOpenChange={setBulkArchiveOpen}
            onConfirm={handleBulkArchive}
            loading={bulkLoading}
            title={showingArchived
              ? `Restore ${selectedCount} Job${selectedCount !== 1 ? "s" : ""}?`
              : `Archive ${selectedCount} Job${selectedCount !== 1 ? "s" : ""}?`}
            description={showingArchived
              ? `This will restore ${selectedCount} selected job${selectedCount !== 1 ? "s" : ""} back to the active list.`
              : `This will archive ${selectedCount} selected job${selectedCount !== 1 ? "s" : ""}. Archived jobs can be restored later.`}
            confirmLabel={showingArchived ? "Restore Jobs" : "Archive Jobs"}
          />

        </>
      )}
    </section>
  );
}
