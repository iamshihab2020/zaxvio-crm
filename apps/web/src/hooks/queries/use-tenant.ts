import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { getTenant, updateTenant } from "@/actions/tenants";

// ── Queries ──────────────────────────────────────────────────

export function useTenantSettings() {
  return useQuery({
    queryKey: queryKeys.tenant.settings(),
    queryFn: () => getTenant(),
    staleTime: 5 * 60_000, // tenant settings rarely change
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
