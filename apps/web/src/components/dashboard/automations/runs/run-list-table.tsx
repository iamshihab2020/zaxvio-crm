"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantTimezone } from "@/hooks/queries/use-tenant";
import { RunStatusBadge } from "./run-status-badge";
import { elapsedMs, formatDuration, formatExact, formatRelative } from "./run-timing";
import { cn } from "@/lib/utils";
import type { WorkflowRunSummary } from "@/actions/workflows";

/**
 * The run list.
 *
 * Ordered newest first, and the columns are chosen to answer the two questions
 * somebody opens this page with — "did the last one work" and "which customer
 * did that happen to". A row is keyboard-reachable, because a table of rows that
 * only open on a mouse click is one the previous six audits each had to fix.
 */

interface Props {
  runs: WorkflowRunSummary[];
  onOpen: (runId: string) => void;
}

export function RunListTable({ runs, onOpen }: Props) {
  const timezone = useTenantTimezone();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[130px]">Status</TableHead>
            <TableHead>Ran for</TableHead>
            <TableHead className="w-[140px]">Started</TableHead>
            <TableHead className="w-[90px] text-right">Steps</TableHead>
            <TableHead className="w-[90px] text-right">Took</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const took = formatDuration(elapsedMs(run.startedAt, run.completedAt));
            return (
              <TableRow
                key={run.id}
                tabIndex={0}
                role="button"
                onClick={() => onOpen(run.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(run.id);
                  }
                }}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                <TableCell>
                  <RunStatusBadge status={run.status} />
                </TableCell>

                <TableCell className="max-w-[280px]">
                  {/* The customer is the subject of almost every automation, so
                      it leads. Where there is none — a manual run with no
                      record — the failure reason takes the space instead of a
                      dash, because a row that failed should say so in the list
                      rather than only once opened. */}
                  <p className="truncate font-body text-sm">
                    {run.customerName ?? <span className="text-muted-foreground">No customer</span>}
                  </p>
                  {run.errorHint && (
                    <p className="truncate text-xs text-red-600 font-body dark:text-red-400">
                      {run.errorHint}
                    </p>
                  )}
                  {!run.errorHint && run.status === "waiting" && run.resumeAt && (
                    <p className="truncate text-xs text-muted-foreground font-body">
                      Carries on {formatRelative(run.resumeAt)}
                    </p>
                  )}
                </TableCell>

                <TableCell
                  className="whitespace-nowrap text-sm text-muted-foreground font-body"
                  title={formatExact(run.startedAt, timezone) ?? undefined}
                >
                  {formatRelative(run.startedAt) ?? "—"}
                </TableCell>

                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {run.nodesExecuted}
                </TableCell>

                <TableCell
                  className={cn(
                    "text-right font-mono text-sm",
                    took ? "text-muted-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {took ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
