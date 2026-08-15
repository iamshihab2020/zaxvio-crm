"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconPencil,
  IconCheck,
  IconX,
  IconLayoutColumns,
} from "@tabler/icons-react";
import {
  getPipelines,
  updatePipeline,
  deletePipeline,
} from "@/actions/pipelines";
import { PipelineCreateDialog } from "@/components/dashboard/pipelines/pipeline-create-dialog";
import { PipelineStagesDialog } from "@/components/dashboard/jobs/pipeline-stages-dialog";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { SettingsPageHeader } from "@/components/dashboard/settings/settings-page-header";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { Input } from "@/components/ui/input";

export interface PipelineData {
  id: string;
  name: string;
  label: string;
  isDefault: boolean;
  stageCount: number;
  jobCount: number;
  createdAt: string;
}

import type { StageLifecycle } from "@/lib/constants/stage-lifecycle";

interface StageData {
  id: string;
  pipelineId: string;
  name: string;
  label: string;
  color: string;
  /** Which of the four real job statuses this stage stands for. */
  lifecycle: StageLifecycle;
  sortOrder: number;
  isDefault: boolean;
  jobCount: number;
}

interface PipelinesSettingsClientProps {
  initialPipelines?: PipelineData[];
}

export function PipelinesSettingsClient({ initialPipelines = [] }: PipelinesSettingsClientProps) {
  const [pipelines, setPipelines] = useState<PipelineData[]>(initialPipelines);
  const [loading, setLoading] = useState(initialPipelines.length === 0);
  const [createOpen, setCreateOpen] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Stages dialog state
  const [stagesDialogOpen, setStagesDialogOpen] = useState(false);
  const [stagesPipelineId, setStagesPipelineId] = useState<string | null>(null);
  const [stagesData, setStagesData] = useState<StageData[]>([]);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPipeline, setDeletingPipeline] = useState<PipelineData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPipelines = useCallback(async () => {
    const result = await getPipelines();
    if (result.data) {
      setPipelines(result.data as PipelineData[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialPipelines.length > 0) return;
    fetchPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreated() {
    setCreateOpen(false);
    await fetchPipelines();
    toast.success("Pipeline created");
  }

  async function handleSetDefault(id: string) {
    const result = await updatePipeline(id, { isDefault: true });
    if (result.error) {
      toast.error(result.error);
    } else {
      await fetchPipelines();
      toast.success("Default pipeline updated");
    }
  }

  function startRename(pipeline: PipelineData) {
    setRenamingId(pipeline.id);
    setRenameValue(pipeline.label);
  }

  async function confirmRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    const result = await updatePipeline(id, { label: trimmed });
    if (result.error) {
      toast.error(result.error);
    } else {
      setRenamingId(null);
      await fetchPipelines();
      toast.success("Pipeline renamed");
    }
  }

  function openStages(pipelineId: string) {
    setStagesPipelineId(pipelineId);
    getPipelineStages(pipelineId).then((result) => {
      if (result.data) {
        setStagesData(result.data as StageData[]);
      }
      setStagesDialogOpen(true);
    });
  }

  async function handleStagesChange() {
    if (stagesPipelineId) {
      const result = await getPipelineStages(stagesPipelineId);
      if (result.data) {
        setStagesData(result.data as StageData[]);
      }
    }
    await fetchPipelines();
  }

  function openDelete(pipeline: PipelineData) {
    setDeletingPipeline(pipeline);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deletingPipeline) return;
    setDeleting(true);
    const result = await deletePipeline(deletingPipeline.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setDeleteOpen(false);
      setDeletingPipeline(null);
      await fetchPipelines();
      toast.success("Pipeline deleted");
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Create and manage multiple job pipelines with custom stages."
        action={
          <Button
            size="sm"
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus className="h-4 w-4" />
            New Pipeline
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-2 h-4 w-48" />
            </div>
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <IconLayoutColumns className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground font-body">
            No pipelines yet. Create your first pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((pipeline) => {
            const isRenaming = renamingId === pipeline.id;
            return (
              <div
                key={pipeline.id}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename(pipeline.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="h-7 w-48 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => confirmRename(pipeline.id)}
                        >
                          <IconCheck className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setRenamingId(null)}
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium font-heading truncate">
                        {pipeline.label}
                      </span>
                    )}

                    {pipeline.isDefault && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider shrink-0">
                        Default
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!pipeline.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Set as default"
                        onClick={() => handleSetDefault(pipeline.id)}
                      >
                        <IconStar className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {pipeline.isDefault && (
                      <div className="h-7 w-7 flex items-center justify-center" title="Default pipeline">
                        <IconStarFilled className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                    )}
                    {!isRenaming && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Rename"
                        onClick={() => startRename(pipeline)}
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => openDelete(pipeline)}
                      disabled={pipeline.isDefault || pipelines.length <= 1}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-4">
                  <span className="text-xs text-muted-foreground font-body">
                    {pipeline.stageCount} stage{pipeline.stageCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground font-body">
                    {pipeline.jobCount} job{pipeline.jobCount !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => openStages(pipeline.id)}
                    className="text-xs font-medium text-brand hover:underline font-body cursor-pointer"
                  >
                    Edit Stages
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PipelineCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
        existingPipelines={pipelines}
      />

      <PipelineStagesDialog
        open={stagesDialogOpen}
        onOpenChange={setStagesDialogOpen}
        stages={stagesData}
        pipelineId={stagesPipelineId}
        onStagesChange={handleStagesChange}
      />

      <DeleteConfirmDialog
        entityName="Pipeline"
        itemLabel={deletingPipeline?.label ?? ""}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
