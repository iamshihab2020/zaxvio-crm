import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
} from "@/actions/pipelines";
import {
  getPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
} from "@/actions/pipeline-stages";

// ── Queries ──────────────────────────────────────────────────

export function usePipelines() {
  return useQuery({
    queryKey: queryKeys.pipelines.list(),
    queryFn: () => getPipelines(),
    staleTime: 5 * 60_000, // pipelines rarely change
  });
}

export function usePipelineStages(pipelineId: string) {
  return useQuery({
    queryKey: queryKeys.pipelines.stages(pipelineId),
    queryFn: () => getPipelineStages(pipelineId),
    enabled: !!pipelineId,
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createPipeline>[0]) => createPipeline(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pipeline created");
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to create pipeline"),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePipeline>[1] }) =>
      updatePipeline(id, data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pipeline updated");
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to update pipeline"),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePipeline(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pipeline deleted");
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to delete pipeline"),
  });
}

export function useCreatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createPipelineStage>[0]) => createPipelineStage(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Stage created");
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to create stage"),
  });
}

export function useUpdatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePipelineStage>[1] }) =>
      updatePipelineStage(id, data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to update stage"),
  });
}

export function useDeletePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePipelineStage(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Stage deleted");
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to delete stage"),
  });
}

export function useReorderPipelineStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof reorderPipelineStages>[0]) => reorderPipelineStages(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.pipelines.all });
    },
    onError: () => toast.error("Failed to reorder stages"),
  });
}
