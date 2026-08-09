/**
 * `notification.internal` — tell the team.
 *
 * Goes through `deliverNotification()`, so channel preferences, dedup and the
 * SSE bell all work already. That is the point of routing through the existing
 * mechanism rather than inserting a `notifications` row: three behaviours the
 * node would otherwise have had to re-implement, and would have re-implemented
 * slightly differently.
 *
 * **Awaited, on the run's own db handle.** The fire-and-forget
 * `dispatchNotification` cannot tell this node what happened, and a node log
 * saying `completed` has to be asserting something the node actually learned.
 * That is DF-NOT-05 — a delivery table that recorded intent instead of outcome
 * and was 100% wrong for its whole existence — one layer up.
 */

import { deliverNotification } from "../../../../lib/notifications.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const notificationInternal: Executor = async ({ db, ctx, params, node }) => {
  const title = asText(params.title);
  const description = asText(params.description);

  if (!title) {
    throw new NodeFailure(
      "Notification node has no title",
      `The "${node.label}" step has no title, so there was nothing to show in the bell. Open the step and add one.`,
    );
  }

  const result = await deliverNotification(db, {
    tenantId: ctx.tenantId,
    // One type for every automation notification. What it is *about* lives in
    // the title — a type per node kind would mean a channel-preference row per
    // node kind per user.
    type: "workflow_alert",
    title,
    description,
    // Point the bell at whatever the run is about, so clicking it lands on the
    // record rather than on the dashboard.
    entityType: ctx.subject?.type ?? undefined,
    entityId: ctx.subject?.id ?? undefined,
    // Null: no person did this. Passing the user who *built* the automation
    // would exclude them from their own alert, since the dispatcher skips the
    // actor — and the whole reason to build one is to be told.
    actorId: null,
    metadata: {
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      executionId: ctx.executionId,
    },
    // One notification per node per run. A run that resumes after a crash and
    // re-enters this node must not ring the bell twice.
    dedupKey: `wf:${ctx.executionId}:${node.id}`,
  });

  // Not an error. "Everyone has this turned off" and "there was nobody but the
  // person who did it" are both the system working; they are recorded as
  // `skipped` with the reason so the run log can say which.
  if (!result.delivered) {
    return { skipped: result.reason, output: { notified: 0 } };
  }

  return {
    output: {
      notified: result.recipients,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
    },
  };
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default notificationInternal;
