"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
import { toast } from "sonner";
import { KanbanBoard } from "@/components/dashboard/jobs/kanban-board";
import { KanbanSkeleton } from "@/components/dashboard/jobs/kanban-skeleton";
import { JobFilters } from "@/components/dashboard/jobs/job-filters";
import { JobsStatsBar } from "@/components/dashboard/jobs/jobs-stats-bar";
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
import type { JobCardData } from "@/components/dashboard/jobs/kanban-card";
import {
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  addJobLineItem,
} from "@/actions/jobs";
import { getPipelines } from "@/actions/pipelines";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { getTenant } from "@/actions/tenants";
import { PipelineSelector } from "@/components/dashboard/jobs/pipeline-selector";
import { JobTable } from "@/components/dashboard/jobs/job-table";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { IconLayoutKanban, IconTable } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
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

export function JobsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("jobs");
  const [pipelinesData, setPipelinesData] = useState<PipelineData[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [stages, setStages] = useState<PipelineStageWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | null>(null);

  // View type: board vs table (persisted)
  const [viewType, setViewType] = useState<"board" | "table">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("jobs-view-type");
      if (stored === "table") return "table";
      // Back-compat: old "jobs-view-mode" had "table" value
      const legacy = localStorage.getItem("jobs-view-mode");
      if (legacy === "table") return "table";
      return "board";
    }
    return "board";
  });

  // Compact density: applies to both board and table (persisted)
  const [compact, setCompact] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("jobs-compact");
      if (stored === "true") return true;
      // Back-compat: old values
      const legacy = localStorage.getItem("jobs-view-mode") ?? localStorage.getItem("jobs-card-view");
      if (legacy === "compact") return true;
      return false;
    }
    return false;
  });

  // Table-specific state
  const [tableJobs, setTableJobs] = useState<JobCardData[]>([]);
  const [tablePagination, setTablePagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [tableSortBy, setTableSortBy] = useState("scheduledDate");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("asc");
  const [tableLoading, setTableLoading] = useState(false);

  function handleViewTypeChange(type: "board" | "table") {
    setViewType(type);
    localStorage.setItem("jobs-view-type", type);
    if (type === "table") {
      fetchJobsForTable(1, tableSortBy, tableSortOrder);
    }
  }

  function handleCompactChange(value: boolean) {
    setCompact(value);
    localStorage.setItem("jobs-compact", String(value));
  }

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Open job detail sheet from URL query param (e.g., /jobs?jobId=xxx)
  const handledJobIdParam = useRef(false);
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
  const [defaultTaxRate, setDefaultTaxRate] = useState<string | undefined>(undefined);

  // Fetch pipeline stages (non-loading, for refreshes)
  const fetchStages = useCallback(async (pipelineId?: string) => {
    const pid = pipelineId ?? selectedPipelineId;
    if (!pid) return;
    const result = await getPipelineStages(pid);
    if (result.data) {
      setStages(result.data as PipelineStageWithCount[]);
    }
  }, [selectedPipelineId]);

  const fetchJobs = useCallback(
    async (
      searchTerm: string,
      priority: JobPriority | null,
      serviceType: ServiceType | null,
      { silent = false, pipelineId }: { silent?: boolean; pipelineId?: string } = {},
    ) => {
      const pid = pipelineId ?? selectedPipelineId;
      if (!silent) setLoading(true);
      const [jobsResult, stagesResult] = await Promise.all([
        getJobs({
          search: searchTerm || undefined,
          priority: priority ?? undefined,
          serviceType: serviceType ?? undefined,
          pipelineId: pid ?? undefined,
          limit: 200,
          sortBy: "scheduledDate",
          sortOrder: "asc",
        }),
        // Only fetch stages on initial load (non-silent), otherwise skip
        !silent && pid ? getPipelineStages(pid) : Promise.resolve(null),
      ]);
      if (jobsResult.data) {
        setJobs(jobsResult.data as JobCardData[]);
      }
      if (stagesResult?.data) {
        setStages(stagesResult.data as PipelineStageWithCount[]);
      }
      if (!silent) setLoading(false);
    },
    [selectedPipelineId],
  );

  const fetchJobsForTable = useCallback(
    async (
      page: number,
      sortBy: string,
      sortOrder: "asc" | "desc",
      searchTerm?: string,
      priority?: JobPriority | null,
      serviceType?: ServiceType | null,
    ) => {
      setTableLoading(true);
      const result = await getJobs({
        search: (searchTerm ?? search) || undefined,
        priority: (priority !== undefined ? priority : priorityFilter) ?? undefined,
        serviceType: (serviceType !== undefined ? serviceType : serviceTypeFilter) ?? undefined,
        pipelineId: selectedPipelineId ?? undefined,
        page,
        limit: 20,
        sortBy,
        sortOrder,
      });
      if (result.data) {
        setTableJobs(result.data as JobCardData[]);
      }
      if (result.pagination) {
        setTablePagination({
          page: result.pagination.page ?? page,
          totalPages: result.pagination.totalPages ?? 1,
          total: result.pagination.total ?? 0,
        });
      }
      setTableLoading(false);
    },
    [search, priorityFilter, serviceTypeFilter, selectedPipelineId],
  );

  // Load pipelines on mount, resolve initial pipeline selection
  useEffect(() => {
    getPipelines().then((result) => {
      if (result.data) {
        const pList = result.data as PipelineData[];
        setPipelinesData(pList);

        // Resolve pipeline: URL > localStorage > default
        const urlPipeline = searchParams.get("pipeline");
        const storedPipeline = typeof window !== "undefined"
          ? localStorage.getItem("jobs-pipeline-id")
          : null;

        let resolvedId: string | null = null;
        if (urlPipeline && pList.some((p) => p.id === urlPipeline)) {
          resolvedId = urlPipeline;
        } else if (storedPipeline && pList.some((p) => p.id === storedPipeline)) {
          resolvedId = storedPipeline;
        } else {
          resolvedId = pList.find((p) => p.isDefault)?.id ?? pList[0]?.id ?? null;
        }

        if (resolvedId) {
          setSelectedPipelineId(resolvedId);
          localStorage.setItem("jobs-pipeline-id", resolvedId);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When pipeline changes, refetch data
  useEffect(() => {
    if (!selectedPipelineId) return;
    fetchJobs("", null, null, { pipelineId: selectedPipelineId });
    if (viewType === "table") {
      fetchJobsForTable(1, tableSortBy, tableSortOrder, "", null, null);
    }
    // Reset search/filters on pipeline switch
    setSearch("");
    setPriorityFilter(null);
    setServiceTypeFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipelineId]);

  function handlePipelineChange(pipelineId: string) {
    setSelectedPipelineId(pipelineId);
    localStorage.setItem("jobs-pipeline-id", pipelineId);
    // Update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set("pipeline", pipelineId);
    router.replace(`/jobs?${params.toString()}`);
  }

  // Fetch tenant default tax rate on mount
  useEffect(() => {
    getTenant().then((result) => {
      if (result.data?.defaultTaxRate) {
        setDefaultTaxRate(result.data.defaultTaxRate as string);
      }
    });
  }, []);

  // Note: Initial fetch is now handled by the selectedPipelineId useEffect above

  // Fetch table data when starting in table mode
  const initialTableFetchDone = useRef(false);
  useEffect(() => {
    if (viewType === "table" && !initialTableFetchDone.current) {
      initialTableFetchDone.current = true;
      fetchJobsForTable(1, tableSortBy, tableSortOrder, "", null, null);
    }
  }, [viewType, fetchJobsForTable, tableSortBy, tableSortOrder]);

  // Debounced search + filter
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs(search, priorityFilter, serviceTypeFilter);
      if (viewType === "table") {
        fetchJobsForTable(1, tableSortBy, tableSortOrder, search, priorityFilter, serviceTypeFilter);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, priorityFilter, serviceTypeFilter, fetchJobs]);

  function handleJobClick(jobId: string) {
    if (viewMode === "page") {
      router.push(`/jobs/${jobId}`);
      return;
    }
    setSelectedJobId(jobId);
    setSheetOpen(true);
  }

  function handleStatusChange() {
    fetchJobs(search, priorityFilter, serviceTypeFilter, { silent: true });
    fetchStages(); // refresh job counts
  }

  function handleTableSort(column: string) {
    const newOrder = tableSortBy === column && tableSortOrder === "asc" ? "desc" : "asc";
    setTableSortBy(column);
    setTableSortOrder(newOrder);
    fetchJobsForTable(tablePagination.page, column, newOrder);
  }

  function handleTablePageChange(page: number) {
    fetchJobsForTable(page, tableSortBy, tableSortOrder);
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

  function handleEditFromSheet(job: JobDetail) {
    setEditingJob(job);
    setSheetOpen(false);
    setDialogOpen(true);
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
        fetchJobs(search, priorityFilter, serviceTypeFilter);
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
      });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        // Add line items if any were provided
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
        fetchJobs(search, priorityFilter, serviceTypeFilter);
        fetchStages(); // refresh counts
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
      fetchJobs(search, priorityFilter, serviceTypeFilter);
      fetchStages(); // refresh counts
    }
    setSaving(false);
  }

  // Computed stats
  const todayStr = new Date().toISOString().split("T")[0];
  const todayJobs = jobs.filter((j) => j.scheduledDate === todayStr).length;
  const urgentCount = jobs.filter(
    (j) => j.priority === "urgent" || j.priority === "emergency",
  ).length;
  const pipelineValue = jobs.reduce(
    (sum, j) => sum + parseFloat(j.totalAmount || "0"),
    0,
  );

  const showNoResults = !loading && jobs.length === 0 && (!!search || !!priorityFilter || !!serviceTypeFilter);
  const stagesReady = stages.length > 0;

  return (
    <section className="p-6 overflow-hidden animate-fade-in-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <PipelineSelector
            pipelines={pipelinesData}
            selectedId={selectedPipelineId}
            onSelect={handlePipelineChange}
          />
          {!loading && viewType !== "table" && (
            <JobsStatsBar
              totalJobs={jobs.length}
              todayJobs={todayJobs}
              urgentCount={urgentCount}
              pipelineValue={pipelineValue}
            />
          )}
          {viewType === "table" && !tableLoading && (
            <span className="text-sm text-muted-foreground font-body">
              {tablePagination.total} job{tablePagination.total !== 1 ? "s" : ""} total
            </span>
          )}
        </div>
        {/* Board / Table view switch */}
        <div className="flex items-center rounded-lg border border-border p-0.5 gap-0.5">
          <button
            onClick={() => handleViewTypeChange("board")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-body font-medium transition-colors cursor-pointer",
              viewType === "board"
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <IconLayoutKanban className="h-4 w-4" />
            Board
          </button>
          <button
            onClick={() => handleViewTypeChange("table")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-body font-medium transition-colors cursor-pointer",
              viewType === "table"
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <IconTable className="h-4 w-4" />
            Table
          </button>
        </div>
        {viewMounted && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
          {error}
        </div>
      )}

      <JobFilters
        search={search}
        onSearchChange={setSearch}
        priority={priorityFilter}
        onPriorityChange={setPriorityFilter}
        serviceType={serviceTypeFilter}
        onServiceTypeChange={setServiceTypeFilter}
        onCreateClick={openCreateDialog}
        onManagePipeline={() => setPipelineDialogOpen(true)}
        compact={compact}
        onCompactChange={handleCompactChange}
        isTableView={viewType === "table"}
      />

      {/* Board view */}
      {viewType === "board" && (
        <>
          {loading && <KanbanSkeleton columnCount={stages.length || 4} />}

          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No jobs found matching your filters
            </p>
          )}

          {!loading && stagesReady && !showNoResults && (
            <KanbanBoard
              jobs={jobs}
              stages={stages}
              onJobClick={handleJobClick}
              onStatusChange={handleStatusChange}
              onAddJob={openCreateDialogForStage}
              cardView={compact ? "compact" : "default"}
            />
          )}
        </>
      )}

      {/* Table view */}
      {viewType === "table" && (
        <>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
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

      <JobDetailSheet
        jobId={selectedJobId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={handleEditFromSheet}
        onDelete={handleDeleteFromSheet}
        onStatusChange={handleStatusChange}
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
        onStagesChange={fetchStages}
      />
    </section>
  );
}
