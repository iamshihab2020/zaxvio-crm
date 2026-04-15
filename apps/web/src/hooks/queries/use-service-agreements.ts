import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getMaintenanceContracts,
  getMaintenanceContract,
  createMaintenanceContract,
  updateMaintenanceContract,
  deleteMaintenanceContract,
  bulkDeleteContracts,
  bulkToggleContractActive,
} from "@/actions/maintenance-contracts";

// ── Queries ──────────────────────────────────────────────────

export function useServiceAgreements(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.serviceAgreements.list(params),
    queryFn: () =>
      getMaintenanceContracts(params as Parameters<typeof getMaintenanceContracts>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useServiceAgreement(id: string) {
  return useQuery({
    queryKey: queryKeys.serviceAgreements.detail(id),
    queryFn: () => getMaintenanceContract(id),
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateServiceAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createMaintenanceContract>[0]) => createMaintenanceContract(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Service agreement created");
      qc.invalidateQueries({ queryKey: queryKeys.serviceAgreements.all });
    },
    onError: () => toast.error("Failed to create service agreement"),
  });
}

export function useUpdateServiceAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateMaintenanceContract>[1];
    }) => updateMaintenanceContract(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Service agreement updated");
      qc.invalidateQueries({ queryKey: queryKeys.serviceAgreements.all });
      qc.invalidateQueries({ queryKey: queryKeys.serviceAgreements.detail(id) });
    },
    onError: () => toast.error("Failed to update service agreement"),
  });
}

export function useDeleteServiceAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMaintenanceContract(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Service agreement deleted");
      qc.invalidateQueries({ queryKey: queryKeys.serviceAgreements.all });
    },
    onError: () => toast.error("Failed to delete service agreement"),
  });
}

export function useBulkDeleteServiceAgreements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteContracts(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Service agreements deleted");
      qc.invalidateQueries({ queryKey: queryKeys.serviceAgreements.all });
    },
    onError: () => toast.error("Failed to delete service agreements"),
  });
}

export function useBulkToggleServiceAgreementActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, isActive }: { ids: string[]; isActive: boolean }) =>
      bulkToggleContractActive(ids, isActive),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Service agreements updated");
      qc.invalidateQueries({ queryKey: queryKeys.serviceAgreements.all });
    },
    onError: () => toast.error("Failed to update service agreements"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchServiceAgreements(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.serviceAgreements.list(params),
    queryFn: () => getMaintenanceContracts(params as Parameters<typeof getMaintenanceContracts>[0]),
  });
}
