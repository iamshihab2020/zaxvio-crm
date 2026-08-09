/**
 * Reading what a run actually did.
 *
 * Until this file existed the engine wrote a careful record — a row per node
 * with its status, its resolved settings, how long it took, why it was skipped
 * and the plain-language reason it failed — and **nothing could read any of
 * it**. `node_execution_logs` had one writer and no reader outside a test. So a
 * tenant could build an automation, publish it, switch it on, and have no way
 * to find out whether it had ever done anything.
 *
 * That is the gap this closes, and it is why the shape below leans on
 * `error_hint` and `skip_reason` rather than on `error_message`: the person
 * opening this page is the person who has to fix the automation, and workflow
 * failures are the largest support load a feature like this creates. A stack
 * trace moves that load; a sentence removes it.
 *
 * Two things it deliberately does not do:
 *
 *  - **No `context_snapshot`.** It is stored for failed nodes and it can be
 *    large, so it is fetched per node on demand rather than in a list of
 *    twenty. A run page that ships a megabyte of context for a run nobody
 *    expands is a page nobody waits for.
 *  - **No re-derivation.** Everything here is read back exactly as the engine
 *    wrote it. A second opinion about whether a run succeeded is precisely the
 *    defect the invoice audit spent a day removing (INV-01/02/03).
 */

import {
  nodeExecutionLogs,
  workflowExecutions,
  workflowVersions,
  workflows,
  customers,
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
  type getDb,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * The five run states, named once.
 *
 * Typed here rather than asserted at the query. `runListQuery` already validates
 * against a Zod enum, so the value arriving is one of these — writing
 * `status as ("running" | ...)[]` at the call site was casting a value back into
 * the type it already had, which is the kind of assertion that keeps compiling
 * long after the enum behind it has changed.
 */
export type ExecutionStatus =
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunListParams {
  tenantId: string;
  workflowId: string;
  page: number;
  limit: number;
  status?: ExecutionStatus[];
  customerId?: string;
}

/**
 * One page of runs, newest first.
 *
 * Joined to `customers` for a name, because "run #4 of 60" is not something
 * anyone can act on and "Maria Delgado — failed" is. The join carries a tenant
 * predicate of its own: matching only on the id is the exact gap the security
 * audit found in conversations, checklists and calendar events.
 */
export async function listRuns(db: Db, params: RunListParams) {
  const { tenantId, workflowId, page, limit } = params;

  const where = and(
    eq(workflowExecutions.tenantId, tenantId),
    eq(workflowExecutions.workflowId, workflowId),
    params.status?.length ? inArray(workflowExecutions.status, params.status) : undefined,
    params.customerId ? eq(workflowExecutions.customerId, params.customerId) : undefined,
  );

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: workflowExecutions.id,
        status: workflowExecutions.status,
        source: workflowExecutions.source,
        triggerEvent: workflowExecutions.triggerEvent,
        startedAt: workflowExecutions.startedAt,
        completedAt: workflowExecutions.completedAt,
        resumeAt: workflowExecutions.resumeAt,
        errorHint: workflowExecutions.errorHint,
        nodesExecuted: workflowExecutions.nodesExecuted,
        contextTruncated: workflowExecutions.contextTruncated,
        subjectType: workflowExecutions.subjectType,
        subjectId: workflowExecutions.subjectId,
        customerId: workflowExecutions.customerId,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        versionNumber: workflowVersions.version,
      })
      .from(workflowExecutions)
      .leftJoin(
        customers,
        and(
          eq(customers.id, workflowExecutions.customerId),
          eq(customers.tenantId, tenantId),
        ),
      )
      .leftJoin(
        workflowVersions,
        // Tenant predicate even though the FK chain already guarantees it: the
        // execution row is tenant-filtered and `workflow_version_id` points out
        // of it. [[security-rules]] §1 is written as "every SELECT", without an
        // exemption for joins you can reason your way out of — and the three
        // ownership gaps the security audit found were all places somebody had
        // reasoned their way out of one.
        and(
          eq(workflowVersions.id, workflowExecutions.workflowVersionId),
          eq(workflowVersions.tenantId, tenantId),
        ),
      )
      .where(where)
      .orderBy(desc(workflowExecutions.startedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(workflowExecutions).where(where),
  ]);

  return {
    runs: rows.map(toRunSummary),
    pagination: {
      page,
      limit,
      total: total?.value ?? 0,
      totalPages: Math.max(1, Math.ceil((total?.value ?? 0) / limit)),
    },
  };
}

/**
 * How this automation has been doing, over its whole history.
 *
 * Counted in SQL rather than from the page of rows above: a tally derived from
 * the first twenty runs describes the first twenty runs, and would sit directly
 * above a paginated list contradicting it.
 */
export async function getRunStats(db: Db, tenantId: string, workflowId: string) {
  const [row] = await db
    .select({
      total: count(),
      // `FILTER` rather than five queries, and integer counts rather than
      // booleans — `z.coerce.boolean()` on a raw row makes the string "false"
      // into `true`, which is how `?showArchived=false` once returned only
      // archived rows.
      running: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'running')::int`,
      waiting: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'waiting')::int`,
      completed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')::int`,
      cancelled: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'cancelled')::int`,
      lastRunAt: sql<string | null>`max(${workflowExecutions.startedAt})`,
    })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, tenantId),
        eq(workflowExecutions.workflowId, workflowId),
      ),
    );

  return {
    total: row?.total ?? 0,
    running: row?.running ?? 0,
    waiting: row?.waiting ?? 0,
    completed: row?.completed ?? 0,
    failed: row?.failed ?? 0,
    cancelled: row?.cancelled ?? 0,
    lastRunAt: row?.lastRunAt ?? null,
  };
}

/**
 * One run and every step it took.
 *
 * Returns `null` when the run does not exist **or** belongs to another tenant —
 * the two are one answer on purpose, because distinguishing them tells an
 * attacker which ids are real.
 */
export async function getRun(
  db: Db,
  tenantId: string,
  workflowId: string,
  runId: string,
) {
  const [run] = await db
    .select({
      id: workflowExecutions.id,
      workflowId: workflowExecutions.workflowId,
      workflowName: workflows.name,
      status: workflowExecutions.status,
      source: workflowExecutions.source,
      triggerEvent: workflowExecutions.triggerEvent,
      triggerNodeId: workflowExecutions.triggerNodeId,
      startedAt: workflowExecutions.startedAt,
      completedAt: workflowExecutions.completedAt,
      resumeAt: workflowExecutions.resumeAt,
      currentNodeId: workflowExecutions.currentNodeId,
      errorMessage: workflowExecutions.errorMessage,
      errorHint: workflowExecutions.errorHint,
      nodesExecuted: workflowExecutions.nodesExecuted,
      contextTruncated: workflowExecutions.contextTruncated,
      parentExecutionId: workflowExecutions.parentExecutionId,
      subjectType: workflowExecutions.subjectType,
      subjectId: workflowExecutions.subjectId,
      customerId: workflowExecutions.customerId,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      versionNumber: workflowVersions.version,
      versionId: workflowExecutions.workflowVersionId,
    })
    .from(workflowExecutions)
    .innerJoin(
      workflows,
      and(eq(workflows.id, workflowExecutions.workflowId), eq(workflows.tenantId, tenantId)),
    )
    .leftJoin(
      customers,
      and(eq(customers.id, workflowExecutions.customerId), eq(customers.tenantId, tenantId)),
    )
    .leftJoin(
      workflowVersions,
      and(
        eq(workflowVersions.id, workflowExecutions.workflowVersionId),
        eq(workflowVersions.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(workflowExecutions.id, runId),
        eq(workflowExecutions.tenantId, tenantId),
        eq(workflowExecutions.workflowId, workflowId),
      ),
    );

  if (!run) return null;

  const steps = await db
    .select({
      id: nodeExecutionLogs.id,
      nodeId: nodeExecutionLogs.nodeId,
      nodeType: nodeExecutionLogs.nodeType,
      nodeLabel: nodeExecutionLogs.nodeLabel,
      sequence: nodeExecutionLogs.sequence,
      status: nodeExecutionLogs.status,
      skipReason: nodeExecutionLogs.skipReason,
      startedAt: nodeExecutionLogs.startedAt,
      completedAt: nodeExecutionLogs.completedAt,
      durationMs: nodeExecutionLogs.durationMs,
      resolvedParams: nodeExecutionLogs.resolvedParams,
      output: nodeExecutionLogs.output,
      errorHint: nodeExecutionLogs.errorHint,
      // `error_message` is the technical one. Sent because a tenant who has
      // escalated needs something to paste, but the UI leads with the hint.
      errorMessage: nodeExecutionLogs.errorMessage,
    })
    .from(nodeExecutionLogs)
    .where(
      and(
        eq(nodeExecutionLogs.executionId, runId),
        eq(nodeExecutionLogs.tenantId, tenantId),
      ),
    )
    .orderBy(asc(nodeExecutionLogs.sequence));

  return {
    ...toRunSummary(run),
    workflowName: run.workflowName,
    versionId: run.versionId,
    triggerNodeId: run.triggerNodeId,
    currentNodeId: run.currentNodeId,
    parentExecutionId: run.parentExecutionId,
    errorMessage: run.errorMessage,
    steps,
  };
}

/**
 * The wire shape of a run.
 *
 * `customerName` is assembled here rather than in the browser so the list, the
 * detail page and any future notification all print the same thing. A name is
 * `null` — not an empty string — when there is no customer, so a caller has to
 * decide what to show rather than rendering a blank.
 */
function toRunSummary<T extends {
  customerFirstName: string | null;
  customerLastName: string | null;
}>(row: T) {
  const name = [row.customerFirstName, row.customerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const { customerFirstName: _first, customerLastName: _last, ...rest } = row;
  return { ...rest, customerName: name || null };
}
