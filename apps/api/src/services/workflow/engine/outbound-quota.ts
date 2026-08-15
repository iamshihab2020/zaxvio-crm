/**
 * How many outbound calls this tenant has made today.
 *
 * Shared by `http.request` and `webhook.send` because they share the budget —
 * two counters would let a tenant spend the limit twice, which is the one thing
 * a limit exists to stop.
 *
 * ## Derived, not counted
 *
 * Read from `node_execution_logs` rather than from a counter column, for the
 * same reason invoice status is derived from its payment rows rather than
 * assigned: a counter is a second source of truth, and it drifts in whichever
 * direction the bug went. A missed decrement locks a tenant out of a feature
 * they are paying for; a missed increment gives them no ceiling at all. Neither
 * is visible until somebody complains.
 *
 * The read is indexed — `idx_node_logs_started` was added for the retention
 * sweep and covers this too.
 */

import {
  nodeExecutionLogs,
  workflowExecutions,
  and,
  count,
  eq,
  gte,
  inArray,
} from "@hvac-saas/database";
import type { ExecutorDb } from "./executors/types.js";

/** The node types that spend the outbound budget. */
const OUTBOUND_NODES = ["http.request", "webhook.send"];

export async function outboundUsedToday(
  db: ExecutorDb,
  tenantId: string,
): Promise<number> {
  // UTC midnight, not the tenant's. A daily quota is an infrastructure budget
  // rather than a business-hours concept, and resolving it per tenant would mean
  // the same shared capacity resetting at twenty-four different moments.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ n: count() })
    .from(nodeExecutionLogs)
    .innerJoin(
      workflowExecutions,
      eq(workflowExecutions.id, nodeExecutionLogs.executionId),
    )
    .where(
      and(
        eq(workflowExecutions.tenantId, tenantId),
        inArray(nodeExecutionLogs.nodeType, OUTBOUND_NODES),
        gte(nodeExecutionLogs.startedAt, since),
      ),
    );

  return Number(row?.n ?? 0);
}
