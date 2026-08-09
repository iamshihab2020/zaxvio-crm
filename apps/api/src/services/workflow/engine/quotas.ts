/**
 * Per-tenant quotas.
 *
 * The system this was ported from has none, and its own audit names that as the
 * gap to close "before you have noisy neighbours". One tenant with a runaway
 * automation is a shared database, a shared worker and — because every tenant's
 * mail leaves from one domain — a shared sender reputation.
 *
 * **Refuse loudly.** A silent cap is a support ticket: the tenant sees an
 * automation that used to work and now does nothing, with no reason anywhere.
 * Every refusal here carries a sentence naming the number and what to do.
 */

import { workflowExecutions, and, count, eq, gte, inArray, sql } from "@hvac-saas/database";
import { TENANT_QUOTAS } from "@hvac-saas/workflow-nodes";
import { QuotaExceeded } from "./errors.js";
import type { ExecutorDb } from "./executors/index.js";

/**
 * Check before starting a run. Throws `QuotaExceeded`, which the caller records
 * and surfaces — it never silently drops.
 *
 * Two counts, one query each. They answer different questions: concurrency
 * protects the worker pool right now, and the daily cap protects everyone else
 * from a loop that has been running since 3am.
 */
export async function assertWithinQuota(
  db: ExecutorDb,
  tenantId: string,
): Promise<void> {
  const [live] = await db
    .select({ n: count() })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, tenantId),
        inArray(workflowExecutions.status, ["running", "waiting"]),
      ),
    );

  // `waiting` counts. A run parked on a three-day delay holds no worker, but it
  // does hold a subject's `active_dedup_key` and it will wake up — excluding
  // them would let a tenant accumulate ten thousand pending runs and discover
  // the limit all at once on Thursday morning.
  if (Number(live?.n ?? 0) >= TENANT_QUOTAS.MAX_CONCURRENT_EXECUTIONS) {
    throw new QuotaExceeded(
      "concurrent",
      `This workspace already has ${TENANT_QUOTAS.MAX_CONCURRENT_EXECUTIONS} automations running or waiting, which is the limit. They'll free up as they finish — if this keeps happening, something is probably enrolling more contacts than you expect.`,
    );
  }

  const [today] = await db
    .select({ n: count() })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, tenantId),
        // A rolling 24 hours, not a calendar day. A calendar day resets at
        // midnight in *some* zone, and whichever one it is will be wrong for
        // most tenants — a rolling window is the same everywhere.
        gte(workflowExecutions.startedAt, sql`now() - interval '24 hours'`),
      ),
    );

  if (Number(today?.n ?? 0) >= TENANT_QUOTAS.MAX_DAILY_EXECUTIONS) {
    throw new QuotaExceeded(
      "daily",
      `This workspace has run ${TENANT_QUOTAS.MAX_DAILY_EXECUTIONS} automations in the last 24 hours, which is the limit. New runs will start again as that number falls.`,
    );
  }
}

/**
 * Today's usage, for the automations list.
 *
 * Quotas are **surfaced before they are enforced**. A tenant who can see "142
 * of 2,000 today" never meets the cap by surprise, and the first refusal is
 * then a number they recognise rather than an outage.
 */
export async function getQuotaUsage(
  db: ExecutorDb,
  tenantId: string,
): Promise<{
  concurrent: number;
  concurrentLimit: number;
  daily: number;
  dailyLimit: number;
}> {
  const [live] = await db
    .select({ n: count() })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, tenantId),
        inArray(workflowExecutions.status, ["running", "waiting"]),
      ),
    );

  const [today] = await db
    .select({ n: count() })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, tenantId),
        gte(workflowExecutions.startedAt, sql`now() - interval '24 hours'`),
      ),
    );

  return {
    concurrent: Number(live?.n ?? 0),
    concurrentLimit: TENANT_QUOTAS.MAX_CONCURRENT_EXECUTIONS,
    daily: Number(today?.n ?? 0),
    dailyLimit: TENANT_QUOTAS.MAX_DAILY_EXECUTIONS,
  };
}
