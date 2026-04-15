import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getReportStats } from "@/actions/reports";
import type { ReportSection } from "@hvac-saas/types";

export function useReportStats(params: {
  section: ReportSection;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: queryKeys.reports.stats(params),
    queryFn: async () => {
      const res = await getReportStats(params);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: !!params.from && !!params.to,
    staleTime: 5 * 60_000, // reports can be 5min stale
  });
}
