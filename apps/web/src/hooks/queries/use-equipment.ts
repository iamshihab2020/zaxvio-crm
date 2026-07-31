import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bulkToast } from "@/lib/bulk-toast";
import { queryKeys } from "@/lib/query-keys";
import {
  getEquipment,
  getEquipmentItem,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  bulkArchiveEquipment,
  bulkRestoreEquipment,
  bulkDeleteEquipment,
} from "@/actions/equipment";

// ── Queries ──────────────────────────────────────────────────

export function useEquipment(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.equipment.list(params),
    queryFn: () => getEquipment(params as Parameters<typeof getEquipment>[0]),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function useEquipmentItem(id: string) {
  return useQuery({
    queryKey: queryKeys.equipment.detail(id),
    queryFn: () => getEquipmentItem(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createEquipment>[0]) => createEquipment(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Asset created");
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
    onError: () => toast.error("Failed to create asset"),
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEquipment>[1] }) =>
      updateEquipment(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Asset updated");
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
      qc.invalidateQueries({ queryKey: queryKeys.equipment.detail(id) });
    },
    onError: () => toast.error("Failed to update asset"),
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Asset deleted");
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
    onError: () => toast.error("Failed to delete asset"),
  });
}

export function useBulkArchiveEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkArchiveEquipment(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Assets archived");
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
    onError: () => toast.error("Failed to archive assets"),
  });
}

export function useBulkRestoreEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkRestoreEquipment(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Assets restored");
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
    onError: () => toast.error("Failed to restore assets"),
  });
}

export function useBulkDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteEquipment(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Assets deleted");
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
    onError: () => toast.error("Failed to delete assets"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchEquipment(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.equipment.list(params),
    queryFn: () => getEquipment(params as Parameters<typeof getEquipment>[0]),
  });
}
