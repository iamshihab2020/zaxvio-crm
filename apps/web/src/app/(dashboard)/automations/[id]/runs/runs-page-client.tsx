"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconArrowLeft, IconHistory } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { RunListTable } from "@/components/dashboard/automations/runs/run-list-table";
import { RunDetailSheet } from "@/components/dashboard/automations/runs/run-detail-sheet";
import { RunStatsRow } from "@/components/dashboard/automations/runs/run-stats-row";
import { useWorkflowRuns } from "@/hooks/queries";
import type { WorkflowRunsPage } from "@/actions/workflows";

/**
 * Run history.
 *
 * The filter and the open run both live in the URL. That is not tidiness: "the
 * failed one from this morning" is the single most-shared thing on this page,
 * and a filter held in component state produces a link that opens on
 * everything.
 */

interface Props {
  id: string;
  workflowName: string;
  initialRuns: WorkflowRunsPage | null;
  initialError: string | null;
  initialRunId: string | null;
  initialStatus: string;
}

/**
 * `all` is a UI value, not a status — it is sent as no filter at all.
 *
 * "Needs a look" is a **set**, which is why the endpoint takes a comma-separated
 * list. Splitting it into three requests merged in the browser is how a page
 * ends up with a total that disagrees with its own rows.
 */
const FILTERS = [
  { value: "all", label: "All" },
  { value: "failed,cancelled", label: "Needs a look" },
  { value: "waiting,running", label: "In progress" },
  { value: "completed", label: "Finished" },
];

export function AutomationRunsPageClient({
  id,
  workflowName,
  initialRuns,
  initialError,
  initialRunId,
  initialStatus,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialStatus);
  const [openRunId, setOpenRunId] = useState<string | null>(initialRunId);

  const params = {
    page,
    limit: 20,
    ...(status !== "all" ? { status } : {}),
  };
  const query = useWorkflowRuns(id, params);

  // The SSR payload seeds only the exact first request it answered. Seeding
  // every key is JOB-05: change the filter and you are shown the unfiltered
  // page, with nothing marking it stale so it never refetches.
  const isFirstRequest = page === 1 && status === initialStatus;
  const data = query.data?.data ?? (isFirstRequest ? initialRuns : null);
  const error = query.isError
    ? "Couldn't reach the server."
    : (query.data?.error ?? (data ? null : isFirstRequest ? initialError : null));

  /**
   * Keep the URL in step without a navigation — this is a filter, not a page.
   *
   * Built from the **next state**, never by reading the current URL back.
   * `router.replace` is not synchronous, so a `useSearchParams()` round trip
   * means two quick changes — open a run, then switch filter — can both read the
   * same stale query string and the second silently drops the first. The two
   * values are already held in state here; the URL is an output of that state,
   * not a second source of it.
   */
  const writeUrl = useCallback(
    (next: { run: string | null; status: string }) => {
      const search = new URLSearchParams();
      if (next.status && next.status !== "all") search.set("status", next.status);
      if (next.run) search.set("run", next.run);
      const qs = search.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  function openRun(runId: string) {
    setOpenRunId(runId);
    writeUrl({ run: runId, status });
  }

  function closeRun() {
    setOpenRunId(null);
    writeUrl({ run: null, status });
  }

  function changeStatus(next: string) {
    setStatus(next);
    setPage(1);
    // The open run is deliberately dropped: a run that failed under the old
    // filter may not be in the new list at all, and leaving its sheet open over
    // a list that no longer contains it is a state nobody can get out of except
    // by guessing.
    setOpenRunId(null);
    writeUrl({ run: null, status: next });
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2">
          <Link href={`/automations/${id}`}>
            <IconArrowLeft className="mr-1.5 h-4 w-4" />
            Back to the builder
          </Link>
        </Button>

        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Runs
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            Every time <strong className="font-medium">{workflowName}</strong> has
            run, and what each step did.
          </p>
        </div>
      </header>

      {data?.stats && <RunStatsRow stats={data.stats} />}

      <StatusFilterTabs options={FILTERS} value={status} onChange={changeStatus} />

      {/* Failed is not empty. A 500 here must never render as "this automation
          has never run" — the distinction LoadErrorState exists to preserve. */}
      {error && !data ? (
        <LoadErrorState
          title="Couldn't load the run history"
          message={error}
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : query.isLoading && !data ? (
        <TableSkeleton columns={5} />
      ) : data && data.runs.length === 0 ? (
        <EmptyRuns filtered={status !== "all"} onClear={() => changeStatus("all")} id={id} />
      ) : data ? (
        <>
          <RunListTable runs={data.runs} onOpen={openRun} />
          {data.pagination.totalPages > 1 && (
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              onPageChange={setPage}
              entityName="run"
            />
          )}
        </>
      ) : null}

      <RunDetailSheet
        workflowId={id}
        runId={openRunId}
        onOpenChange={(open) => {
          if (!open) closeRun();
        }}
      />
    </section>
  );
}

/**
 * Two different empty states, because they mean different things.
 *
 * "No runs match this filter" is a dead end with an obvious way out. "This has
 * never run" is a different situation entirely, and the useful thing to say is
 * how to make it run — not to congratulate the user on an empty list.
 */
function EmptyRuns({
  filtered,
  onClear,
  id,
}: {
  filtered: boolean;
  onClear: () => void;
  id: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <IconHistory className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 font-heading text-base font-semibold">
        {filtered ? "Nothing matches this filter" : "This automation hasn't run yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground font-body">
        {filtered
          ? "Try another filter to see the rest of the history."
          : "Publish it and switch it on, or press Run in the builder to try it on one record."}
      </p>
      <div className="mt-4">
        {filtered ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Show all runs
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href={`/automations/${id}`}>Open the builder</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
