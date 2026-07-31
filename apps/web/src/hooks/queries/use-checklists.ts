import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getChecklistTemplates,
  getChecklistTemplate,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "@/actions/checklists";

// ── Queries ──────────────────────────────────────────────────

export function useChecklistTemplates(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.checklists.list(params),
    queryFn: () =>
      getChecklistTemplates(params as Parameters<typeof getChecklistTemplates>[0]),
    placeholderData: (prev) => prev,
    // Templates change about as often as pipelines do.
    staleTime: 5 * 60_000,
  });
}

export function useChecklistTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.checklists.detail(id),
    queryFn: () => getChecklistTemplate(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createChecklistTemplate>[0]) => createChecklistTemplate(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Checklist template created");
      qc.invalidateQueries({ queryKey: queryKeys.checklists.all });
    },
    onError: () => toast.error("Failed to create checklist template"),
  });
}

export function useUpdateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateChecklistTemplate>[1];
    }) => updateChecklistTemplate(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Checklist template updated");
      qc.invalidateQueries({ queryKey: queryKeys.checklists.all });
      qc.invalidateQueries({ queryKey: queryKeys.checklists.detail(id) });
    },
    onError: () => toast.error("Failed to update checklist template"),
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChecklistTemplate(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Checklist template deleted");
      qc.invalidateQueries({ queryKey: queryKeys.checklists.all });
    },
    onError: () => toast.error("Failed to delete checklist template"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchChecklistTemplates(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.checklists.list(params),
    queryFn: () => getChecklistTemplates(params as Parameters<typeof getChecklistTemplates>[0]),
  });
}
