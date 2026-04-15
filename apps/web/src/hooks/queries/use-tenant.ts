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
