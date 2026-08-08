"use client";

import { useTenantTimezone } from "@/hooks/queries/use-tenant";
import { formatExact, formatRelative } from "./run-timing";
import { cn } from "@/lib/utils";
import type { WorkflowRunStats } from "@/actions/workflows";

/**
 * How this automation has been doing.
 *
 * Counted in SQL over the whole history, not derived from the twenty rows
 * below. A tally computed from the current page describes the current page, and
 * would sit directly above a paginated list contradicting it — which is REP-02
 * and DASH-07's shape: two numbers on one screen that cannot both be right.
 *
 * **Failed leads when there is anything to lead with.** The reason someone opens
 * this page is almost never "how many finished".
 */

interface Props {
  stats: WorkflowRunStats;
}

export function RunStatsRow({ stats }: Props) {
  const timezone = useTenantTimezone();
  const inFlight = stats.running + stats.waiting;

  const cards = [
    { label: "Runs", value: stats.total, tone: "neutral" as const },
    {
      label: "Failed",
      value: stats.failed,
      // Zero failures is genuinely good news and worth saying in green; a
      // non-zero count is worth saying in red. The same neutral grey for both
      // is the version that tells you nothing at a glance.
      tone: stats.failed > 0 ? ("bad" as const) : ("good" as const),
    },
    { label: "In progress", value: inFlight, tone: inFlight > 0 ? ("busy" as const) : ("neutral" as const) },
    { label: "Finished", value: stats.completed, tone: "neutral" as const },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <p className="text-xs text-muted-foreground font-body">{card.label}</p>
            <p
              className={cn(
                "mt-0.5 font-mono text-xl font-semibold tabular-nums",
                card.tone === "bad" && "text-red-600 dark:text-red-400",
                card.tone === "good" && "text-emerald-600 dark:text-emerald-400",
                card.tone === "busy" && "text-violet-600 dark:text-violet-400",
              )}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {stats.lastRunAt && (
        <p
          className="text-xs text-muted-foreground font-body"
          title={formatExact(stats.lastRunAt, timezone) ?? undefined}
        >
          Last ran {formatRelative(stats.lastRunAt)}.
          {stats.cancelled > 0 && (
            <>
              {" "}
              {/* Stopped is not failed — a `logic.stop` set to "Stopped early"
                  is the automation working. Reported, but not as a problem. */}
              {stats.cancelled} {stats.cancelled === 1 ? "run" : "runs"} stopped
              early on purpose.
            </>
          )}
        </p>
      )}
    </div>
  );
}
