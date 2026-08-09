import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  and,
  eq,
  getDb,
  nodeExecutionLogs,
  sql,
  workflowEdges,
  workflowExecutions,
  workflowNodes,
  workflowVersions,
  workflows,
} from "@hvac-saas/database";
import { requireDatabase } from "./setup.js";
import { expectViolation, withRollback, type TestDb } from "./db.js";
import { createTenant, createWorkspace, foreignId } from "./factories/index.js";

/**
 * P1 verification — every constraint proved by execution, not by reading DDL.
 *
 * The repo's standard: the invoices migration was verified 79/79 by running it,
 * and the jobs stage split 13/13. A `CREATE UNIQUE INDEX` line in a file is not
 * evidence that a duplicate is refused; an insert that raises `23505` is.
 *
 * Everything runs inside `withRollback`, so this writes real rows against real
 * Neon and leaves nothing behind.
 */

beforeAll(() => {
  requireDatabase();
});

const PG_FK_VIOLATION = "23503";
/**
 * `ON DELETE RESTRICT` raises 23001 (restrict_violation), **not** 23503.
 *
 * The distinction is real and worth asserting on: RESTRICT checks immediately
 * and can never be deferred, while NO ACTION checks at the end of the statement
 * and could be deferred by a future `SET CONSTRAINTS`. Version pinning depends
 * on the check being immediate, so testing for the precise code is testing the
 * guarantee rather than "something went wrong".
 */
const PG_RESTRICT_VIOLATION = "23001";
const PG_UNIQUE_VIOLATION = "23505";
const PG_NOT_NULL_VIOLATION = "23502";

/** A minimal published version, which every execution needs to point at. */
async function createWorkflowWithVersion(
  db: TestDb,
  tenantId: string,
  overrides: { isActive?: boolean; triggerTypes?: string[] } = {},
) {
  const [workflow] = await db
    .insert(workflows)
    .values({
      tenantId,
      name: "Test automation",
      isActive: overrides.isActive ?? false,
    })
    .returning({ id: workflows.id, updatedAt: workflows.updatedAt });

  const [version] = await db
    .insert(workflowVersions)
    .values({
      tenantId,
      workflowId: workflow.id,
      version: 1,
      graph: { nodes: [], edges: [] },
      triggerTypes: overrides.triggerTypes ?? ["job.completed"],
      nodeCount: 0,
    })
    .returning({ id: workflowVersions.id });

  await db
    .update(workflows)
    .set({ activeVersionId: version.id })
    .where(eq(workflows.id, workflow.id));

  return { workflowId: workflow.id, versionId: version.id, updatedAt: workflow.updatedAt };
}

describe("workflows", () => {
  it("defaults to inactive — drawing is not publishing", async () => {
    await withRollback(async (db) => {
      const { tenantId } = await createTenant(db);
      const [row] = await db
        .insert(workflows)
        .values({ tenantId, name: "Draft" })
        .returning({ isActive: workflows.isActive, activeVersionId: workflows.activeVersionId });

      expect(row.isActive).toBe(false);
      expect(row.activeVersionId).toBeNull();
    });
  });

  it("refuses a tenant that does not exist", async () => {
    await withRollback(async (db) => {
      await expectViolation(db, PG_FK_VIOLATION, (tx) =>
        tx.insert(workflows).values({ tenantId: foreignId(), name: "Orphan" }),
      );
    });
  });

  it("keeps version numbers unique per workflow", async () => {
    await withRollback(async (db) => {
      const { tenantId } = await createTenant(db);
      const { workflowId } = await createWorkflowWithVersion(db, tenantId);

      await expectViolation(db, PG_UNIQUE_VIOLATION, (tx) =>
        tx.insert(workflowVersions).values({
          tenantId,
          workflowId,
          version: 1,
          graph: { nodes: [], edges: [] },
        }),
      );
    });
  });

  it("will not delete a version that a run is pinned to", async () => {
    // This is the guarantee behind version pinning. Without ON DELETE RESTRICT,
    // a retention sweep could remove the graph a paused run is going to resume
    // into — and it would only surface three days later, on resume.
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);

      await db.insert(workflowExecutions).values({
        tenantId: ws.tenantId,
        workflowId,
        workflowVersionId: versionId,
        source: "manual",
        subjectType: "job",
        subjectId: ws.jobId,
        customerId: ws.customerId,
      });

      await expectViolation(db, PG_RESTRICT_VIOLATION, (tx) =>
        tx.delete(workflowVersions).where(eq(workflowVersions.id, versionId)),
      );
    });
  });
});

describe("the draft graph", () => {
  it("accepts client-minted node ids and stores them verbatim", async () => {
    await withRollback(async (db) => {
      const { tenantId } = await createTenant(db);
      const { workflowId } = await createWorkflowWithVersion(db, tenantId);

      const nodeId = randomUUID();
      await db.insert(workflowNodes).values({
        id: nodeId,
        tenantId,
        workflowId,
        nodeType: "trigger.manual",
        nodeConfig: { label: "Run manually", parameters: { subjectType: "job" } },
        positionX: 120,
        positionY: 80,
      });

      const [row] = await db
        .select()
        .from(workflowNodes)
        .where(and(eq(workflowNodes.tenantId, tenantId), eq(workflowNodes.id, nodeId)));

      expect(row.id).toBe(nodeId);
      expect(row.nodeType).toBe("trigger.manual");
      expect(row.nodeConfig).toEqual({
        label: "Run manually",
        parameters: { subjectType: "job" },
      });
    });
  });

  it("defaults source_handle to main and stores an explicit handle id", async () => {
    await withRollback(async (db) => {
      const { tenantId } = await createTenant(db);
      const { workflowId } = await createWorkflowWithVersion(db, tenantId);
      const a = randomUUID();
      const b = randomUUID();

      const [implicit] = await db
        .insert(workflowEdges)
        .values({ id: randomUUID(), tenantId, workflowId, sourceNodeId: a, targetNodeId: b })
        .returning({ handle: workflowEdges.sourceHandle });
      expect(implicit.handle).toBe("main");

      // A stable id, never the display label — renaming "Found" must not break
      // routing on a saved automation.
      const [explicit] = await db
        .insert(workflowEdges)
        .values({
          id: randomUUID(),
          tenantId,
          workflowId,
          sourceNodeId: a,
          sourceHandle: "not_found",
          targetNodeId: b,
        })
        .returning({ handle: workflowEdges.sourceHandle });
      expect(explicit.handle).toBe("not_found");
    });
  });

  it("cascades the graph away when the workflow is deleted", async () => {
    await withRollback(async (db) => {
      const { tenantId } = await createTenant(db);
      const { workflowId } = await createWorkflowWithVersion(db, tenantId);
      await db.insert(workflowNodes).values({
        id: randomUUID(),
        tenantId,
        workflowId,
        nodeType: "logic.stop",
        nodeConfig: { label: "Stop", parameters: {} },
      });

      await db.delete(workflows).where(eq(workflows.id, workflowId));

      const left = await db
        .select({ id: workflowNodes.id })
        .from(workflowNodes)
        .where(eq(workflowNodes.workflowId, workflowId));
      expect(left).toEqual([]);
    });
  });
});

describe("execution deduplication", () => {
  it("refuses a duplicate idempotency key", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const key = `idem-${randomUUID()}`;

      const base = {
        tenantId: ws.tenantId,
        workflowId,
        workflowVersionId: versionId,
        source: "event" as const,
        subjectType: "job" as const,
        subjectId: ws.jobId,
        customerId: ws.customerId,
      };

      await db.insert(workflowExecutions).values({ ...base, idempotencyKey: key });
      await expectViolation(db, PG_UNIQUE_VIOLATION, (tx) =>
        tx.insert(workflowExecutions).values({ ...base, idempotencyKey: key }),
      );
    });
  });

  it("allows many rows with a NULL idempotency key", async () => {
    // The index is partial. Manual and test runs carry no key and must not
    // collide with each other.
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const base = {
        tenantId: ws.tenantId,
        workflowId,
        workflowVersionId: versionId,
        source: "manual" as const,
      };

      await db.insert(workflowExecutions).values(base);
      await db.insert(workflowExecutions).values(base);

      const rows = await db
        .select({ id: workflowExecutions.id })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, workflowId));
      expect(rows.length).toBe(2);
    });
  });

  it("refuses a second live run for the same subject", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const dedup = `${workflowId}:job:${ws.jobId}`;

      const base = {
        tenantId: ws.tenantId,
        workflowId,
        workflowVersionId: versionId,
        source: "event" as const,
        subjectType: "job" as const,
        subjectId: ws.jobId,
        customerId: ws.customerId,
        activeDedupKey: dedup,
      };

      await db.insert(workflowExecutions).values(base);

      // A `waiting` run is just as live as a `running` one — the index covers
      // both, which is what stops a chatty trigger creating five parallel runs
      // during a three-day delay.
      await expectViolation(db, PG_UNIQUE_VIOLATION, (tx) =>
        tx.insert(workflowExecutions).values({ ...base, status: "waiting" }),
      );
    });
  });

  it("allows a new run once the previous one has finished", async () => {
    // The negative case matters as much as the positive one. A non-partial
    // index here would mean a subject could only ever be enrolled once, which
    // is not the rule — the rule is one run *at a time*.
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const dedup = `${workflowId}:job:${ws.jobId}`;
      const base = {
        tenantId: ws.tenantId,
        workflowId,
        workflowVersionId: versionId,
        source: "event" as const,
        subjectType: "job" as const,
        subjectId: ws.jobId,
        customerId: ws.customerId,
        activeDedupKey: dedup,
      };

      const [first] = await db
        .insert(workflowExecutions)
        .values(base)
        .returning({ id: workflowExecutions.id });

      await db
        .update(workflowExecutions)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(workflowExecutions.id, first.id));

      const [second] = await db
        .insert(workflowExecutions)
        .values(base)
        .returning({ id: workflowExecutions.id });

      expect(second.id).not.toBe(first.id);
    });
  });

  it("makes the compare-and-set transition claim exactly once", async () => {
    // Every transition out of `running` is UPDATE ... WHERE status = 'running'.
    // The second attempt must claim zero rows, which is what stops a delay
    // pause and a concurrent goal exit both believing they own the run.
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const [run] = await db
        .insert(workflowExecutions)
        .values({
          tenantId: ws.tenantId,
          workflowId,
          workflowVersionId: versionId,
          source: "event",
          subjectType: "job",
          subjectId: ws.jobId,
        })
        .returning({ id: workflowExecutions.id });

      const claim = (status: "waiting" | "completed") =>
        db
          .update(workflowExecutions)
          .set({ status })
          .where(
            and(
              eq(workflowExecutions.id, run.id),
              eq(workflowExecutions.status, "running"),
            ),
          )
          .returning({ id: workflowExecutions.id });

      expect(await claim("waiting")).toHaveLength(1);
      expect(await claim("completed")).toHaveLength(0);
    });
  });
});

describe("node logs", () => {
  it("survive the deletion of the node they describe", async () => {
    // No foreign key on node_id, on purpose. Deleting a step from the draft
    // graph must not erase the record of what that step did last week.
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const nodeId = randomUUID();

      await db.insert(workflowNodes).values({
        id: nodeId,
        tenantId: ws.tenantId,
        workflowId,
        nodeType: "email.send",
        nodeConfig: { label: "Send email", parameters: {} },
      });

      const [run] = await db
        .insert(workflowExecutions)
        .values({
          tenantId: ws.tenantId,
          workflowId,
          workflowVersionId: versionId,
          source: "manual",
        })
        .returning({ id: workflowExecutions.id });

      await db.insert(nodeExecutionLogs).values({
        tenantId: ws.tenantId,
        executionId: run.id,
        nodeId,
        workflowId,
        nodeType: "email.send",
        nodeLabel: "Send email",
        sequence: 1,
        status: "completed",
        resolvedParams: { to: "dana@example.test" },
      });

      await db.delete(workflowNodes).where(eq(workflowNodes.id, nodeId));

      const [log] = await db
        .select({ nodeId: nodeExecutionLogs.nodeId, type: nodeExecutionLogs.nodeType })
        .from(nodeExecutionLogs)
        .where(eq(nodeExecutionLogs.executionId, run.id));

      expect(log.nodeId).toBe(nodeId);
      expect(log.type).toBe("email.send");
    });
  });

  it("refuses a duplicate attempt for one node in one run", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const [run] = await db
        .insert(workflowExecutions)
        .values({
          tenantId: ws.tenantId,
          workflowId,
          workflowVersionId: versionId,
          source: "manual",
        })
        .returning({ id: workflowExecutions.id });

      const nodeId = randomUUID();
      const log = {
        tenantId: ws.tenantId,
        executionId: run.id,
        nodeId,
        workflowId,
        nodeType: "email.send",
        sequence: 1,
        status: "running" as const,
      };

      await db.insert(nodeExecutionLogs).values(log);
      await expectViolation(db, PG_UNIQUE_VIOLATION, (tx) =>
        tx.insert(nodeExecutionLogs).values(log),
      );

      // A later sequence is a legitimate re-visit — loops and goto revisit nodes.
      const ok = await db
        .insert(nodeExecutionLogs)
        .values({ ...log, sequence: 2 })
        .returning({ id: nodeExecutionLogs.id });
      expect(ok).toHaveLength(1);
    });
  });

  it("requires a status", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const [run] = await db
        .insert(workflowExecutions)
        .values({
          tenantId: ws.tenantId,
          workflowId,
          workflowVersionId: versionId,
          source: "manual",
        })
        .returning({ id: workflowExecutions.id });

      const nodeId = randomUUID();
      await expectViolation(db, PG_NOT_NULL_VIOLATION, (tx) =>
        tx.execute(
          sql`INSERT INTO node_execution_logs
                (tenant_id, execution_id, node_id, workflow_id, node_type, sequence)
              VALUES (${ws.tenantId}, ${run.id}, ${nodeId}, ${workflowId}, 'email.send', 1)`,
        ),
      );
    });
  });
});

describe("tenant isolation", () => {
  it("keeps one tenant's automations invisible to another", async () => {
    // There is no row-level security under this. The application is the only
    // boundary, so the assertion has to exist per table rather than once.
    await withRollback(async (db) => {
      const a = await createTenant(db);
      const b = await createTenant(db);
      const { workflowId } = await createWorkflowWithVersion(db, b.tenantId);

      const visible = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(and(eq(workflows.tenantId, a.tenantId), eq(workflows.id, workflowId)));

      expect(visible).toEqual([]);
    });
  });

  it("does not let a dedup key collide across tenants", async () => {
    // The key is prefixed with the workflow id, which is unique per tenant, so
    // two tenants automating the same-looking thing never contend.
    await withRollback(async (db) => {
      const a = await createWorkspace(db);
      const b = await createWorkspace(db);
      const wa = await createWorkflowWithVersion(db, a.tenantId);
      const wb = await createWorkflowWithVersion(db, b.tenantId);

      await db.insert(workflowExecutions).values({
        tenantId: a.tenantId,
        workflowId: wa.workflowId,
        workflowVersionId: wa.versionId,
        source: "event",
        activeDedupKey: `${wa.workflowId}:job:${a.jobId}`,
      });

      const [second] = await db
        .insert(workflowExecutions)
        .values({
          tenantId: b.tenantId,
          workflowId: wb.workflowId,
          workflowVersionId: wb.versionId,
          source: "event",
          activeDedupKey: `${wb.workflowId}:job:${b.jobId}`,
        })
        .returning({ id: workflowExecutions.id });

      expect(second.id).toBeTruthy();
    });
  });
});

describe("the resume query", () => {
  it("finds only waiting runs whose resume_at has passed", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const { workflowId, versionId } = await createWorkflowWithVersion(db, ws.tenantId);
      const base = {
        tenantId: ws.tenantId,
        workflowId,
        workflowVersionId: versionId,
        source: "event" as const,
      };

      const past = new Date(Date.now() - 60_000);
      const future = new Date(Date.now() + 60 * 60_000);

      const [due] = await db
        .insert(workflowExecutions)
        .values({ ...base, status: "waiting", resumeAt: past })
        .returning({ id: workflowExecutions.id });
      await db
        .insert(workflowExecutions)
        .values({ ...base, status: "waiting", resumeAt: future });
      // A goal wait: waiting with no resume_at. The resume worker must never
      // pick these up — only a matching event or the reaper moves them.
      await db.insert(workflowExecutions).values({ ...base, status: "waiting" });
      await db
        .insert(workflowExecutions)
        .values({ ...base, status: "running", resumeAt: past });

      const claimable = await db
        .select({ id: workflowExecutions.id })
        .from(workflowExecutions)
        .where(
          and(
            eq(workflowExecutions.workflowId, workflowId),
            eq(workflowExecutions.status, "waiting"),
            sql`${workflowExecutions.resumeAt} IS NOT NULL`,
            sql`${workflowExecutions.resumeAt} <= now()`,
          ),
        );

      expect(claimable.map((r) => r.id)).toEqual([due.id]);
    });
  });
});
