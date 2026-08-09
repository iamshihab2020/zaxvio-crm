import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getTenant,
  updateTenant,
  getMemberRates,
  setMemberRate,
  clearMemberRate,
} from "@/actions/tenants";

// ── Queries ──────────────────────────────────────────────────

export function useTenantSettings() {
  return useQuery({
    queryKey: queryKeys.tenant.settings(),
    queryFn: () => getTenant(),
    staleTime: 5 * 60_000, // tenant settings rarely change
  });
}

/**
 * Every member of the business with their effective hourly cost.
 *
 * Owner/admin only on the API, because a rate is what the business pays a
 * person. A `403` here is the correct answer for a member, not a bug.
 */
export function useMemberRates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant.memberRates(),
    queryFn: () => getMemberRates(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof updateTenant>[0]) => updateTenant(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: queryKeys.tenant.all });
    },
    onError: () => toast.error("Failed to save settings"),
  });
}

export function useSetMemberRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; hourlyCostRate: string }) =>
      setMemberRate(vars.userId, vars.hourlyCostRate),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Cost rate saved");
      qc.invalidateQueries({ queryKey: queryKeys.tenant.memberRates() });
    },
    onError: () => toast.error("Failed to save the rate"),
  });
}

export function useClearMemberRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => clearMemberRate(userId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Back to the default rate");
      qc.invalidateQueries({ queryKey: queryKeys.tenant.memberRates() });
    },
    onError: () => toast.error("Failed to clear the rate"),
  });
}

/**
 * The tenant's IANA timezone, with a safe fallback while the query is in flight.
 *
 * Falls back to the *viewer's* zone, never to UTC — a UTC fallback is what made
 * "Today" jump to tomorrow's jobs at 6pm Central (JOB-20, CUST-06). Components
 * that render dates should compare against this rather than `new Date()`.
 */
export function useTenantTimezone(): string {
  const query = useTenantSettings();
  const tenantZone = (
    query.data?.data as { timezone?: string } | undefined
  )?.timezone;
  return (
    tenantZone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC")
  );
}
