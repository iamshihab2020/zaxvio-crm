import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { getTags, createTag, updateTag, deleteTag } from "@/actions/tags";

// ── Queries ──────────────────────────────────────────────────

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.list(),
    queryFn: () => getTags(),
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      createTag(name, color),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tag created");
      qc.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
    onError: () => toast.error("Failed to create tag"),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color?: string }) =>
      updateTag(id, name, color),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tag updated");
      qc.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
    onError: () => toast.error("Failed to update tag"),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tag deleted");
      qc.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
    onError: () => toast.error("Failed to delete tag"),
  });
}
