"use client";

import { IconAlertTriangle, IconClock } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { useWorkflowRun } from "@/hooks/queries";
import { useTenantTimezone } from "@/hooks/queries/use-tenant";
import { RunStatusBadge } from "./run-status-badge";
import { RunStepList } from "./run-step-list";
import { elapsedMs, formatDuration, formatExact, formatRelative } from "./run-timing";

/**
 * One run, opened from the list.
 *
 * A sheet rather than a page, because the question is almost always asked in a
 * sequence — "this one failed, what about the one before it" — and a full
 * navigation per run turns that into four page loads. The run id still lives in
 * the URL, so a link to a specific failure can be sent to somebody.
 */

interface Props {
  workflowId: string;
  runId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function RunDetailSheet({ workflowId, runId, onOpenChange }: Props) {
  const query = useWorkflowRun(workflowId, runId);
  const timezone = useTenantTimezone();

  const run = query.data?.data?.run ?? null;
  const error = query.isError ? "Couldn't reach the server." : query.data?.error;

  return (
    <Sheet open={runId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border px-6 py-4 text-left">
          <SheetTitle className="font-heading">Run details</SheetTitle>
          <SheetDescription className="font-body">
            {run
              ? `${run.customerName ?? describeSource(run.source)} · ${formatRelative(run.startedAt) ?? ""}`
              : "Every step this run took, in order."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {query.isLoading && !run && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          )}

          {error && !run && (
            <LoadErrorState
              title="Couldn't load this run"
              message={error}
              onRetry={() => query.refetch()}
              isRetrying={query.isFetching}
            />
          )}

          {run && (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <Field label="Status">
                  <RunStatusBadge status={run.status} />
                </Field>
                <Field label="Started by">{describeSource(run.source)}</Field>
                <Field label="Started" title={formatExact(run.startedAt, timezone)}>
                  {formatRelative(run.startedAt) ?? "—"}
                </Field>
                <Field label="Took">
                  {formatDuration(elapsedMs(run.startedAt, run.completedAt)) ??
                    (run.status === "waiting" || run.status === "running"
                      ? "Still going"
                      : "—")}
                </Field>
                <Field label="Steps run">{run.nodesExecuted}</Field>
                <Field label="Version">
                  {/* Which version it ran on is not trivia: a run resumes on the
                      version it STARTED on, so a paused run and the automation
                      you are looking at can legitimately differ. */}
                  {run.versionNumber !== null ? `v${run.versionNumber}` : "—"}
                </Field>
              </dl>

              {/* A waiting run's most important fact is when it comes back. The
                  execution row holds one `resume_at` for the whole run, so this
                  is the run's next wake-up, not any particular step's. */}
              {run.status === "waiting" && run.resumeAt && (
                <p
                  className="flex items-start gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-body"
                  title={formatExact(run.resumeAt, timezone) ?? undefined}
                >
                  <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>
                    Paused. It carries on{" "}
                    <strong className="font-medium">{formatRelative(run.resumeAt)}</strong>.
                  </span>
                </p>
              )}

              {run.status === "waiting" && !run.resumeAt && (
                <p className="flex items-start gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-body">
                  <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>Paused until something it is waiting for happens.</span>
                </p>
              )}

              {run.errorHint && (
                <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-body">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>{run.errorHint}</span>
                </p>
              )}

              {/* The context was capped and older step outputs were dropped. A
                  truncation you can see beats a silently incomplete replay. */}
              {run.contextTruncated && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-body">
                  This run carried more data than it could store, so some earlier
                  step results were dropped. The steps below are complete.
                </p>
              )}

              <div>
                <h3 className="mb-2 font-heading text-sm font-semibold">Steps</h3>
                <RunStepList steps={run.steps} />
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  title,
  children,
}: {
  label: string;
  title?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div title={title ?? undefined}>
      <dt className="text-xs text-muted-foreground font-body">{label}</dt>
      <dd className="mt-0.5 text-sm font-body">{children}</dd>
    </div>
  );
}

/**
 * How the run started, in the user's words rather than the enum's.
 *
 * `sub` and `replay` have no user-facing feature behind them yet, so they read
 * plainly rather than exposing a term nothing in the product explains.
 */
function describeSource(source: string): string {
  const LABELS: Record<string, string> = {
    event: "Something in your CRM",
    manual: "Run by hand",
    test: "A test",
    webhook: "A webhook",
    schedule: "A schedule",
    sub: "Another automation",
    replay: "A replay",
  };
  return LABELS[source] ?? "Unknown";
}
