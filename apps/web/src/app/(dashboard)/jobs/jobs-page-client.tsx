"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { KanbanBoard } from "@/components/dashboard/jobs/kanban-board";
import { KanbanSkeleton } from "@/components/dashboard/jobs/kanban-skeleton";
import { JobFilters } from "@/components/dashboard/jobs/job-filters";
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
} from "@/actions/jobs";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { getTenant } from "@/actions/tenants";
import type { JobPriority, ServiceType } from "@/lib/constants/job-options";

interface PipelineStageWithCount {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  jobCount: number;
}

export function JobsPageClient() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [stages, setStages] = useState<PipelineStageWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | null>(null);

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
  const fetchStages = useCallback(async () => {
    const result = await getPipelineStages();
    if (result.data) {
      setStages(result.data as PipelineStageWithCount[]);
    }
  }, []);

  const fetchJobs = useCallback(
    async (
      searchTerm: string,
      priority: JobPriority | null,
      serviceType: ServiceType | null,
      { silent = false } = {},
    ) => {
      if (!silent) setLoading(true);
      const [jobsResult, stagesResult] = await Promise.all([
        getJobs({
          search: searchTerm || undefined,
          priority: priority ?? undefined,
          serviceType: serviceType ?? undefined,
          limit: 200,
          sortBy: "scheduledDate",
          sortOrder: "asc",
        }),
        // Only fetch stages on initial load (non-silent), otherwise skip
        !silent ? getPipelineStages() : Promise.resolve(null),
      ]);
      if (jobsResult.data) {
        setJobs(jobsResult.data as JobCardData[]);
      }
      if (stagesResult?.data) {
        setStages(stagesResult.data as PipelineStageWithCount[]);
      }
      if (!silent) setLoading(false);
    },
    [],
  );

  // Fetch tenant default tax rate on mount
  useEffect(() => {
    getTenant().then((result) => {
      if (result.data?.defaultTaxRate) {
        setDefaultTaxRate(result.data.defaultTaxRate as string);
      }
    });
  }, []);

  // Initial fetch (jobs + stages together)
  useEffect(() => {
    fetchJobs("", null, null);
  }, [fetchJobs]);

  // Debounced search + filter
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs(search, priorityFilter, serviceTypeFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, priorityFilter, serviceTypeFilter, fetchJobs]);

  function handleJobClick(jobId: string) {
    setSelectedJobId(jobId);
    setSheetOpen(true);
  }

  function handleStatusChange() {
    fetchJobs(search, priorityFilter, serviceTypeFilter, { silent: true });
    fetchStages(); // refresh job counts
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
      });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
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

  const showNoResults = !loading && jobs.length === 0 && (!!search || !!priorityFilter || !!serviceTypeFilter);
  const stagesReady = stages.length > 0;

  return (
    <section className="p-6 overflow-hidden" aria-labelledby="jobs-heading">
      <div className="mb-6 flex items-center justify-between">
        <h1
          id="jobs-heading"
          className="font-heading text-2xl font-bold text-foreground"
        >
          Jobs
        </h1>
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
      />

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
        />
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
        onStagesChange={fetchStages}
      />
    </section>
  );
}
