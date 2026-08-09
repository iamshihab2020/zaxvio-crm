"use client";

import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { useWorkflowQuota } from "@/hooks/queries";
import { cn } from "@/lib/utils";

/**
 * How close this tenant is to their automation limits.
 *
 * `GET /workflows/quota` and `useWorkflowQuota` both existed and **nothing
 * rendered either** — an audit found the hook with zero callers. That was not a
 * tidiness problem: hitting the limit refuses every event-triggered run, and
 * before this the tenant's only symptom was that their automations quietly
 * stopped. The engine now raises a notification when it happens; this is the
 * part that lets somebody see it coming.
 *
 * **Silent until it matters.** A permanent "3 of 2000 runs today" bar teaches
 * people to ignore the space it occupies, so nothing renders below 80%. The one
 * thing worth saying at 4% is nothing.
 */

/** Show nothing below this. Above it, the number stops being trivia. */
const WARN_AT = 0.8;

export function QuotaNotice() {
  const query = useWorkflowQuota();
  const quota = query.data?.data;

  // A failed quota read is not worth a banner of its own — the page it sits on
  // has its own error state, and a warning about a warning helps nobody.
  if (!quota) return null;

  const daily = ratio(quota.daily, quota.dailyLimit);
  const concurrent = ratio(quota.concurrent, quota.concurrentLimit);
  const worst = Math.max(daily, concurrent);

  if (worst < WARN_AT) return null;

  const atLimit = worst >= 1;
  const Icon = atLimit ? IconAlertTriangle : IconInfoCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-body",
        atLimit
          ? "border-red-500/30 bg-red-500/10"
          : "border-amber-500/30 bg-amber-500/10",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          atLimit ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-500",
        )}
      />
      <div>
        <p>
          <strong className="font-medium">
            {atLimit ? "Your automations have paused." : "You're near your automation limit."}
          </strong>{" "}
          {/* Name the limit that is actually tight, not both. Two numbers where
              one is at 4% makes the reader work out which one matters. */}
          {daily >= concurrent
            ? `${quota.daily.toLocaleString()} of ${quota.dailyLimit.toLocaleString()} runs used in the last 24 hours.`
            : `${quota.concurrent} of ${quota.concurrentLimit} automations running or waiting at once.`}
        </p>
        {atLimit && (
          <p className="mt-0.5 text-muted-foreground">
            New runs are being turned away until you&apos;re back under it. Nothing
            is lost — switch off an automation you don&apos;t need, or wait.
          </p>
        )}
      </div>
    </div>
  );
}

/** Guards a zero or absent limit, which would otherwise be `Infinity` or `NaN`. */
function ratio(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return used / limit;
}
