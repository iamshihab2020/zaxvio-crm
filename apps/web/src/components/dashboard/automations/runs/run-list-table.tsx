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
 *
 * Below `md` it is two columns, not five: status, then the customer with when it
 * started, how many steps it took and how long that took folded under it —
 * the same move `automations-table.tsx` makes with the trigger. Dropping those
 * columns outright would lose the numbers; keeping all five at 375px is a table
 * that scrolls sideways inside its own border.
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
            <TableHead className="md:w-[130px]">Status</TableHead>
            <TableHead>Ran for</TableHead>
            <TableHead className="hidden w-[140px] md:table-cell">Started</TableHead>
            <TableHead className="hidden w-[90px] text-right md:table-cell">Steps</TableHead>
            <TableHead className="hidden w-[90px] text-right md:table-cell">Took</TableHead>
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

                {/* `max-w-0 w-full` is the table idiom for "take what is left, and
                    truncate inside it": without it a long customer name sets the
                    column's width and the row outgrows a phone. From `md` the
                    280px cap applies as before. */}
                <TableCell className="w-full max-w-0 md:w-auto md:max-w-[280px]">
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
                  {/* What the three hidden columns hold, for a phone. */}
                  <p
                    className="mt-0.5 truncate text-xs text-muted-foreground font-body md:hidden"
                    title={formatExact(run.startedAt, timezone) ?? undefined}
                  >
                    {formatRelative(run.startedAt) ?? "—"} · {run.nodesExecuted}{" "}
                    {run.nodesExecuted === 1 ? "step" : "steps"}
                    {took ? ` · ${took}` : ""}
                  </p>
                </TableCell>

                <TableCell
                  className="hidden whitespace-nowrap text-sm text-muted-foreground font-body md:table-cell"
                  title={formatExact(run.startedAt, timezone) ?? undefined}
                >
                  {formatRelative(run.startedAt) ?? "—"}
                </TableCell>

                <TableCell className="hidden text-right font-mono text-sm text-muted-foreground md:table-cell">
                  {run.nodesExecuted}
                </TableCell>

                <TableCell
                  className={cn(
                    "hidden text-right font-mono text-sm md:table-cell",
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
