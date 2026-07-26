import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getDashboardStats,
  getDashboardPipeline,
  type DashboardStatsParams,
} from "@/actions/dashboard";

type StatsResult = Awaited<ReturnType<typeof getDashboardStats>>;

interface UseDashboardStatsOptions {
  /** Server-rendered payload. Only seeded when it matches the requested params. */
  initialData?: StatsResult;
  /** The params `initialData` was fetched with. */
  initialParams?: DashboardStatsParams;
  /** When the server fetched `initialData`, so staleness is measured honestly. */
  initialFetchedAt?: number;
}

function sameParams(a?: DashboardStatsParams, b?: DashboardStatsParams): boolean {
  return (
    a?.from === b?.from &&
    a?.to === b?.to &&
    a?.granularity === b?.granularity
  );
}

export function useDashboardStats(
  dateParams?: DashboardStatsParams,
  options: UseDashboardStatsOptions = {},
) {
  const { initialData, initialParams, initialFetchedAt } = options;

  // `initialData` seeds whatever key is active, and TanStack stamps it as fetched
  // "now" unless told otherwise. Passing it unconditionally meant switching to 1Y
  // seeded that key with month-to-date numbers and — being inside staleTime —
  // never fetched. Only seed the key the server actually rendered.
  const canSeed = Boolean(initialData) && sameParams(dateParams, initialParams);

  const query = useQuery({
    queryKey: queryKeys.dashboard.stats(dateParams),
    queryFn: () => getDashboardStats(dateParams),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    ...(canSeed
      ? {
          initialData,
          initialDataUpdatedAt: initialFetchedAt,
        }
      : {}),
  });

  useToastOnError(query.data?.error ?? (query.error ? "Failed to load dashboard" : null));

  return query;
}

export function useDashboardPipeline(pipelineId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.dashboard.pipeline(pipelineId),
    queryFn: () => getDashboardPipeline(pipelineId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  useToastOnError(query.data?.error ?? null);

  return query;
}

/**
 * Surface a fetch error once per distinct message. Toasting inside `queryFn` fired
 * on every retry, stacking up to four identical toasts for one outage.
 */
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
