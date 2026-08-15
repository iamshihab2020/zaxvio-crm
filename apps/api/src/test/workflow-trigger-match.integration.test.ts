import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { workflows, workflowVersions, eq } from "@hvac-saas/database";
import type { WorkflowGraph } from "@hvac-saas/types";

import { requireDatabase } from "./setup.js";
import { withRollback, type TestDb } from "./db.js";
import { createWorkspace } from "./factories/index.js";
import { handleTriggerEvent } from "../services/workflow/triggers/index.js";
import { collectTriggerTypes } from "../services/workflow/graph/publish.js";
import type { ClaimedEvent } from "../services/workflow/events/worker.js";

/**
 * The candidate lookup, against a real database.
 *
 * This file exists because of two bugs on the same line, three days apart, and
 * **neither was reachable without executing SQL**:
 *
 *  1. The predicate compared `trigger_types` (event names, written by
 *     `collectTriggerTypes`) against an array of *node ids*. Both sides were
 *     `string[]`, so it type-checked; the overlap was simply always empty and
 *     nothing ever fired.
 *  2. After that was fixed, the array was interpolated straight into the `sql`
 *     template — `&& ${eventTypes}` — which binds a JS array as one scalar
 *     parameter. Postgres then tried to read `job.created` as an array literal
 *     and raised `22P02 malformed array literal`. Every dispatched event threw,
 *     retried, and the automation still never ran.
 *
 * A unit test cannot catch either. The first needs the two vocabularies in the
 * same assertion; the second needs a real parse by a real server. So the tests
 * below are deliberately *integration* tests that assert on rows, not mocks.
 */

requireDatabase();

/** Publish-shaped: an active workflow whose live version listens for `events`. */
async function publishListener(
  db: TestDb,
  tenantId: string,
  events: string[],
  graphNodes: Array<{ id: string; nodeType: string }> = [],
) {
  const [workflow] = await db
    .insert(workflows)
    .values({ tenantId, name: `listener-${randomUUID().slice(0, 8)}`, isActive: true })
    .returning();

  const graph: WorkflowGraph = {
    nodes: graphNodes.map((n) => ({
      id: n.id,
      nodeType: n.nodeType,
      nodeConfig: { label: n.nodeType, parameters: {} },
      positionX: 0,
      positionY: 0,
    })),
    edges: [],
  };

  const [version] = await db
    .insert(workflowVersions)
    .values({
      tenantId,
      workflowId: workflow.id,
      version: 1,
      graph,
      triggerTypes: events,
      nodeCount: graph.nodes.length,
      publishedBy: null,
    })
    .returning();

  await db
    .update(workflows)
    .set({ activeVersionId: version.id })
    .where(eq(workflows.id, workflow.id));

  return { workflowId: workflow.id, versionId: version.id };
}

function claimed(tenantId: string, eventType: string, subjectId: string | null): ClaimedEvent {
  return {
    id: randomUUID(),
    tenantId,
    eventType,
    payload: {},
    causationDepth: 0,
    subjectType: subjectId ? "job" : null,
    subjectId,
    actorUserId: null,
    subscriber: "workflow_trigger",
    attempts: 1,
    maxAttempts: 5,
    correlationId: randomUUID(),
  };
}

describe("trigger candidate lookup", () => {
  it("does not throw — the array parameter is a real text[]", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await publishListener(db, ws.tenantId, ["job.completed"]);

      // Before the fix this raised `22P02 malformed array literal`, which the
      // outbox recorded as a retryable infrastructure failure. Asserting "does
      // not reject" is the whole point: the *result* was never the bug.
      await expect(
        handleTriggerEvent(db, claimed(ws.tenantId, "job.completed", ws.jobId)),
      ).resolves.toBeDefined();
    });
  });

  it("still parses when several event names are passed at once", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await publishListener(db, ws.tenantId, ["job.completed", "job.created"]);

      // A one-element array happens to look like a scalar in the driver's own
      // error output, which is part of why the bug read as ambiguous. Two
      // elements make the array-ness unmistakable.
      await expect(
        handleTriggerEvent(db, claimed(ws.tenantId, "job.created", ws.jobId)),
      ).resolves.toBeDefined();
    });
  });

  it("finds the automation whose trigger_types hold EVENT names", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const triggerNodeId = randomUUID();
      await publishListener(db, ws.tenantId, ["job.completed"], [
        { id: triggerNodeId, nodeType: "trigger.job.completed" },
      ]);

      const outcomes = await handleTriggerEvent(
        db,
        claimed(ws.tenantId, "job.completed", ws.jobId),
      );

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].triggerNodeId).toBe(triggerNodeId);
    });
  });

  it("finds nothing when trigger_types hold NODE ids — the original bug, inverted", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await publishListener(db, ws.tenantId, ["trigger.job.completed"], [
        { id: randomUUID(), nodeType: "trigger.job.completed" },
      ]);

      // Storing the node id is what the matcher used to *query* for. If this
      // ever starts matching, the two vocabularies have been confused again.
      const outcomes = await handleTriggerEvent(
        db,
        claimed(ws.tenantId, "job.completed", ws.jobId),
      );
      expect(outcomes).toHaveLength(0);
    });
  });

  it("does not cross tenants", async () => {
    await withRollback(async (db) => {
      const mine = await createWorkspace(db);
      const theirs = await createWorkspace(db);
      await publishListener(db, theirs.tenantId, ["job.completed"], [
        { id: randomUUID(), nodeType: "trigger.job.completed" },
      ]);

      const outcomes = await handleTriggerEvent(
        db,
        claimed(mine.tenantId, "job.completed", mine.jobId),
      );
      expect(outcomes).toHaveLength(0);
    });
  });

  it("ignores a workflow that is published but switched off", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const listener = await publishListener(db, ws.tenantId, ["job.completed"], [
        { id: randomUUID(), nodeType: "trigger.job.completed" },
      ]);
      await db
        .update(workflows)
        .set({ isActive: false })
        .where(eq(workflows.id, listener.workflowId));

      const outcomes = await handleTriggerEvent(
        db,
        claimed(ws.tenantId, "job.completed", ws.jobId),
      );
      expect(outcomes).toHaveLength(0);
    });
  });
});

describe("collectTriggerTypes writes what the matcher reads", () => {
  it("emits event names, never node ids", () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: randomUUID(),
          nodeType: "trigger.job.completed",
          nodeConfig: { label: "Job Completed", parameters: {} },
          positionX: 0,
          positionY: 0,
        },
      ],
      edges: [],
    };
    const types = collectTriggerTypes(graph);

    // The assertion that ties the two halves together. `trigger.job.completed`
    // is the node id; `job.completed` is the event. Only one of them can be in
    // this column, and the matcher decides which.
    expect(types).toEqual(["job.completed"]);
    expect(types).not.toContain("trigger.job.completed");
  });
});
