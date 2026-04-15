import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getAdminDashboard,
  getAdminTenants,
  getAdminTenant,
  getAdminTenantAnalytics,
  deactivateTenant,
  activateTenant,
  extendTrial,
  deleteTenant,
  getAdminMRR,
  getAdminSignups,
  getActiveUsers,
  getTrialConversion,
  getChurnList,
  getAuditLog,
  getImpersonationLog,
  getSystemHealth,
  getWebhookLogs,
  getCronHistory,
  getAdminAnalytics,
  getInactiveAlerts,
  getFeatureAdoption,
} from "@/actions/admin";

// ── Queries ──────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => getAdminDashboard(),
  });
}

export function useAdminTenants(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.admin.tenants(params),
    queryFn: () => getAdminTenants(params as Parameters<typeof getAdminTenants>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useAdminTenant(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.tenantDetail(id),
    queryFn: () => getAdminTenant(id),
    enabled: !!id,
  });
}

export function useAdminTenantAnalytics(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.tenantAnalytics(id),
    queryFn: () => getAdminTenantAnalytics(id),
    enabled: !!id,
  });
}

export function useAdminMRR() {
  return useQuery({
    queryKey: queryKeys.admin.mrr(),
    queryFn: () => getAdminMRR(),
    staleTime: 5 * 60_000,
  });
}

export function useAdminSignups() {
  return useQuery({
    queryKey: queryKeys.admin.signups(),
    queryFn: () => getAdminSignups(),
    staleTime: 5 * 60_000,
  });
}

export function useAdminActiveUsers() {
  return useQuery({
    queryKey: queryKeys.admin.activeUsers(),
    queryFn: () => getActiveUsers(),
    staleTime: 5 * 60_000,
  });
}

export function useAdminTrialConversion() {
  return useQuery({
    queryKey: queryKeys.admin.trialConversion(),
    queryFn: () => getTrialConversion(),
    staleTime: 5 * 60_000,
  });
}

export function useAdminChurnList(days?: number) {
  return useQuery({
    queryKey: queryKeys.admin.churnList(days),
    queryFn: () => getChurnList(days),
  });
}

export function useAdminAuditLog(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.admin.auditLog(params),
    queryFn: () => getAuditLog(params as Parameters<typeof getAuditLog>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useAdminImpersonationLog(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.admin.impersonationLog(params),
    queryFn: () =>
      getImpersonationLog(params as Parameters<typeof getImpersonationLog>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: queryKeys.admin.analytics(),
    queryFn: () => getAdminAnalytics(),
    staleTime: 5 * 60_000,
  });
}

export function useAdminSystemHealth() {
  return useQuery({
    queryKey: queryKeys.admin.systemHealth(),
    queryFn: () => getSystemHealth(),
  });
}

export function useAdminWebhookLogs(limit?: number) {
  return useQuery({
    queryKey: queryKeys.admin.webhookLogs(limit),
    queryFn: () => getWebhookLogs(limit),
  });
}

export function useAdminCronHistory(limit?: number) {
  return useQuery({
    queryKey: queryKeys.admin.cronHistory(limit),
    queryFn: () => getCronHistory(limit),
  });
}

export function useAdminInactiveAlerts() {
  return useQuery({
    queryKey: queryKeys.admin.inactiveAlerts(),
    queryFn: () => getInactiveAlerts(),
  });
}

export function useAdminFeatureAdoption() {
  return useQuery({
    queryKey: queryKeys.admin.featureAdoption(),
    queryFn: () => getFeatureAdoption(),
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useDeactivateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateTenant(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tenant deactivated");
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: () => toast.error("Failed to deactivate tenant"),
  });
}

export function useActivateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateTenant(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tenant activated");
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: () => toast.error("Failed to activate tenant"),
  });
}

export function useExtendTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => extendTrial(id, days),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Trial extended");
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: () => toast.error("Failed to extend trial"),
  });
}

export function useDeleteTenantAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmBusinessName }: { id: string; confirmBusinessName: string }) =>
      deleteTenant(id, confirmBusinessName),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tenant deleted");
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: () => toast.error("Failed to delete tenant"),
  });
}
