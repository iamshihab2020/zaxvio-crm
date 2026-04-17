import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { getDashboardStats } from "@/actions/dashboard";

export function useDashboardStats(
  dateParams?: { from: string; to: string; granularity?: "day" | "week" | "month"; pipelineId?: string },
  initialData?: Awaited<ReturnType<typeof getDashboardStats>>,
) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(dateParams),
    queryFn: async () => {
      const res = await getDashboardStats(dateParams);
      if (res.error) toast.error(res.error);
      return res;
    },
    initialData,
    staleTime: 60_000,
  });
}
