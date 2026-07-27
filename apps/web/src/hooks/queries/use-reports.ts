import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getReportStats,
  type ReportStatsParams,
  type ReportStatsResult,
} from "@/actions/reports";

interface UseReportStatsOptions {
  /** Server-rendered payload. Only seeded when it matches the requested params. */
  initialData?: ReportStatsResult;
  /** The params `initialData` was fetched with. */
  initialParams?: ReportStatsParams;
  /** When the server fetched `initialData`, so staleness is measured honestly. */
  initialFetchedAt?: number;
}

function sameParams(a?: ReportStatsParams, b?: ReportStatsParams): boolean {
  return (
    a?.section === b?.section &&
    a?.from === b?.from &&
    a?.to === b?.to &&
    a?.granularity === b?.granularity
  );
}

/**
 * The query no longer throws on error.
 *
 * It used to `throw new Error(res.error)` inside `queryFn`, which left `data`
 * undefined; the page had no error branch, so every failure — a 500, an expired
 * session, a dropped connection — rendered as "No data available for this
 * period." Returning the `{ data, error }` envelope lets the page tell a failed
 * request apart from a genuinely empty one.
 */
export function useReportStats(
  params: ReportStatsParams,
  options: UseReportStatsOptions = {},
) {
  const { initialData, initialParams, initialFetchedAt } = options;
  const canSeed = Boolean(initialData) && sameParams(params, initialParams);

  const query = useQuery({
    queryKey: queryKeys.reports.stats(params),
    queryFn: () => getReportStats(params),
    staleTime: 5 * 60_000, // reports can be 5min stale
    // Keeps the rendered report on screen while a new date range loads instead
    // of blanking the page to a skeleton on every picker change.
    placeholderData: (previous) => previous,
    ...(canSeed
      ? { initialData, initialDataUpdatedAt: initialFetchedAt }
      : {}),
  });

  useToastOnError(
    query.data?.error ?? (query.error ? "Failed to load report data" : null),
  );

  return query;
}

/** Surface a fetch error once per distinct message, not once per retry. */
function useToastOnError(message: string | null) {
  const lastShown = useRef<string | null>(null);

  useEffect(() => {
    if (!message) {
      lastShown.current = null;
      return;
    }
    if (lastShown.current === message) return;
    lastShown.current = message;
    toast.error(message);
  }, [message]);
}
