import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getCatalogItems,
  getCatalogCategories,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  bulkDeleteCatalogItems,
  bulkToggleCatalogActive,
} from "@/actions/catalog";

// ── Queries ──────────────────────────────────────────────────

export function useCatalogItems(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.catalog.list(params),
    queryFn: () => getCatalogItems(params as Parameters<typeof getCatalogItems>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: () => getCatalogCategories(),
    staleTime: 5 * 60_000,
  });
}

export function useCatalogItem(id: string) {
  return useQuery({
    queryKey: queryKeys.catalog.detail(id),
    queryFn: () => getCatalogItem(id),
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createCatalogItem>[0]) => createCatalogItem(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Catalog item created");
      qc.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: () => toast.error("Failed to create catalog item"),
  });
}

export function useUpdateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCatalogItem>[1] }) =>
      updateCatalogItem(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Catalog item updated");
      qc.invalidateQueries({ queryKey: queryKeys.catalog.all });
      qc.invalidateQueries({ queryKey: queryKeys.catalog.detail(id) });
    },
    onError: () => toast.error("Failed to update catalog item"),
  });
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCatalogItem(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Catalog item deleted");
      qc.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: () => toast.error("Failed to delete catalog item"),
  });
}

export function useBulkDeleteCatalogItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteCatalogItems(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Catalog items deleted");
      qc.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: () => toast.error("Failed to delete catalog items"),
  });
}

export function useBulkToggleCatalogActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, isActive }: { ids: string[]; isActive: boolean }) =>
      bulkToggleCatalogActive(ids, isActive),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Catalog items updated");
      qc.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: () => toast.error("Failed to update catalog items"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchCatalogItems(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.catalog.list(params),
    queryFn: () => getCatalogItems(params as Parameters<typeof getCatalogItems>[0]),
  });
}
