/**
 * Running one node.
 *
 * Four things happen here that the system this was ported from does elsewhere
 * or not at all:
 *
 * 1. **Interpolation is one pass, before dispatch** (D-08). An executor cannot
 *    ship a field that forgot to resolve variables, because resolving is not
 *    something an executor does.
 * 2. **Ownership is re-checked at execution time** (D-16). A config's
 *    `memberId` was valid when the graph was saved; the row can be deleted and
 *    the automation can be duplicated into another workspace. There is no RLS
 *    underneath.
 * 3. **The log row is written `running` before the side effect** (D-22). A
 *    resume that finds one for an at-most-once node refuses rather than sending
 *    twice.
 * 4. **`skipped` and `waiting` are logged**, not only success and failure. The
 *    replay view is unusable otherwise — "why did this customer not get the
 *    email" is answered by a skipped row with a reason, and by nothing else.
 */

import { nodeExecutionLogs, and, eq } from "@hvac-saas/database";
import {
  requireDefinition,
  type ExecutionContext,
  type NodeDefinition,
} from "@hvac-saas/workflow-nodes";
import type { GraphNode } from "@hvac-saas/types";
import { getExecutor, type ExecutorDb, type ExecutorOutput } from "./executors/index.js";
import { interpolateParameters, type Diagnostic } from "./interpolate.js";
import { refreshAfterNode } from "./context.js";
import { assertOwnership } from "./ownership.js";
import { DelayPause, GoalWait, NodeFailure, WorkflowSignal } from "./errors.js";

export interface ExecuteNodeResult {
  handle: string;
  output: Record<string, unknown>;
  skipped: boolean;
  diagnostics: Diagnostic[];
}

export interface ExecuteNodeParams {
  db: ExecutorDb;
  ctx: ExecutionContext;
  node: GraphNode;
  sequence: number;
}

/**
 * Execute one node and write exactly one log row for it.
 *
 * Signals (`DelayPause`, `GoalWait`, `WorkflowStopped`) are re-thrown after the
 * log is updated — they are control flow, not failures, and the engine above
 * decides what they mean.
 */
export async function executeNode(
  params: ExecuteNodeParams,
): Promise<ExecuteNodeResult> {
  const { db, ctx, node, sequence } = params;
  const definition = requireDefinition(node.nodeType);
  const label = node.nodeConfig.label || definition.displayName;
  const startedAt = Date.now();

  // ── disabled ──────────────────────────────────────────────────────────────
  //
  // The primary debugging tool: switch a step off, run it again, see what
  // changes. It leaves by `main` so the rest of the chain still runs — a
  // disabled step that halted the run would be a delete, not a disable.
  if (node.nodeConfig.disabled) {
    await writeLog(db, ctx, node, label, sequence, {
      status: "skipped",
      skipReason: "This step is switched off",
      durationMs: 0,
    });
    return { handle: "main", output: {}, skipped: true, diagnostics: [] };
  }

  // ── at-most-once re-entry guard ───────────────────────────────────────────
  if (definition.sideEffect === "at-most-once") {
    const priorAttempt = await findRunningLog(db, ctx.executionId, node.id);
    if (priorAttempt) {
      // Loud, not silent. A crash mid-send leaves this row behind, and the
      // honest answer is "we do not know whether the customer got that email".
      // Sending again to be safe is the wrong kind of safe.
      await writeLog(db, ctx, node, label, sequence, {
        status: "failed",
        errorMessage: "Re-entered an at-most-once node",
        errorHint:
          `"${label}" was already running when this automation stopped unexpectedly, so it may have already sent. It was not run again — check the customer's history before re-running this automation.`,
        durationMs: 0,
      });
      throw new NodeFailure(
        `Node ${node.id} may have already run`,
        `"${label}" may have already run.`,
      );
    }
  }

  // ── interpolate, once, over everything ────────────────────────────────────
  const skip = new Set(
    definition.properties.filter((p) => p.noInterpolate).map((p) => p.name),
  );
  const encodings = Object.fromEntries(
    definition.properties
      .filter((p) => p.encoding)
      .map((p) => [p.name, p.encoding]),
  );

  const { value: resolvedParams, diagnostics } = interpolateParameters(
    node.nodeConfig.parameters ?? {},
    ctx,
    { skip, encodings },
  );

  // ── ownership, at execution time ──────────────────────────────────────────
  const ownershipFailure = await checkOwnership(db, ctx, definition, resolvedParams);
  if (ownershipFailure) {
    await writeLog(db, ctx, node, label, sequence, {
      status: "failed",
      resolvedParams,
      errorMessage: ownershipFailure.message,
      errorHint: ownershipFailure.hint,
      durationMs: Date.now() - startedAt,
    });
    throw ownershipFailure;
  }

  const executor = getExecutor(node.nodeType);
  if (!executor) {
    const failure = new NodeFailure(
      `No executor for ${node.nodeType}`,
      `The "${label}" step isn't available yet. Remove it from this automation, or replace it with a step that is.`,
    );
    await writeLog(db, ctx, node, label, sequence, {
      status: "failed",
      resolvedParams,
      errorMessage: failure.message,
      errorHint: failure.hint,
      durationMs: Date.now() - startedAt,
    });
    throw failure;
  }

  // ── the log row goes in BEFORE the side effect ────────────────────────────
  const logId = await writeLog(db, ctx, node, label, sequence, {
    status: "running",
    resolvedParams,
  });

  try {
    const result: ExecutorOutput = await executor({
      db,
      ctx,
      params: resolvedParams,
      node: { id: node.id, type: node.nodeType, label },
    });

    if (result.skipped) {
      await updateLog(db, logId, {
        status: "skipped",
        skipReason: result.skipped,
        output: result.output ?? null,
        durationMs: Date.now() - startedAt,
      });
      return {
        handle: result.handle ?? "main",
        output: result.output ?? {},
        skipped: true,
        diagnostics,
      };
    }

    await updateLog(db, logId, {
      status: "completed",
      output: result.output ?? null,
      durationMs: Date.now() - startedAt,
    });

    // Declarative, not imperative: the node said what it changes and the engine
    // re-reads it and invalidates the analytics cache. See `context.ts` for why
    // that cache line is the easiest thing here to forget.
    await refreshAfterNode(db, ctx, definition.mutates);

    return {
      handle: result.handle ?? "main",
      output: result.output ?? {},
      skipped: false,
      diagnostics,
    };
  } catch (err) {
    // A pause is not a failure. The log says `waiting` and the signal goes up
    // to the engine, which serialises the context and sets `resume_at`.
    if (err instanceof DelayPause || err instanceof GoalWait) {
      await updateLog(db, logId, {
        status: "waiting",
        durationMs: Date.now() - startedAt,
      });
      throw err;
    }

    // `logic.stop` and friends: the author's choice, not an error.
    if (err instanceof WorkflowSignal && !(err instanceof NodeFailure)) {
      await updateLog(db, logId, {
        status: "completed",
        durationMs: Date.now() - startedAt,
      });
      throw err;
    }

    const hint =
      err instanceof NodeFailure
        ? err.hint
        : `The "${label}" step didn't finish. ${err instanceof Error ? err.message : "Something went wrong."}`;

    await updateLog(db, logId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      errorHint: hint,
      // Failed nodes only. A full context snapshot per node per run is what
      // makes this table unmanageable, and a node that succeeded is not the one
      // being debugged.
      contextSnapshot: snapshot(ctx),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

/**
 * Re-check every property the definition marked with an `ownership` kind.
 *
 * A kind with no checker returns false and therefore fails the node. The safe
 * direction is a node that refuses until someone writes the check — a
 * permissive default would make adding a new ownership kind silently unsafe.
 */
async function checkOwnership(
  db: ExecutorDb,
  ctx: ExecutionContext,
  definition: NodeDefinition,
  params: Record<string, unknown>,
): Promise<NodeFailure | null> {
  for (const property of definition.properties) {
    if (!property.ownership) continue;
    const value = params[property.name];
    if (typeof value !== "string" || value === "") continue;

    const owned = await assertOwnership(db, ctx.tenantId, property.ownership, value);
    if (!owned) {
      return new NodeFailure(
        `Ownership check failed for ${property.ownership} ${value}`,
        `The ${property.displayName.toLowerCase()} this step points at no longer exists in this workspace. Open the step and pick a different one.`,
      );
    }
  }
  return null;
}

/** Small on purpose — the subject and the variables, not the node outputs. */
function snapshot(ctx: ExecutionContext): Record<string, unknown> {
  return {
    subject: ctx.subject,
    customerId: ctx.customer?.id ?? null,
    trigger: ctx.trigger,
    vars: ctx.vars,
    loop: ctx.loop ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Log rows
// ─────────────────────────────────────────────────────────────────────────────

interface LogFields {
  status: "running" | "completed" | "failed" | "skipped" | "waiting";
  skipReason?: string;
  resolvedParams?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  contextSnapshot?: Record<string, unknown>;
  errorMessage?: string;
  errorHint?: string;
  durationMs?: number;
}

async function writeLog(
  db: ExecutorDb,
  ctx: ExecutionContext,
  node: GraphNode,
  label: string,
  sequence: number,
  fields: LogFields,
): Promise<string> {
  const [row] = await db
    .insert(nodeExecutionLogs)
    .values({
      tenantId: ctx.tenantId,
      executionId: ctx.executionId,
      nodeId: node.id,
      workflowId: ctx.workflowId,
      nodeType: node.nodeType,
      nodeLabel: label,
      sequence,
      status: fields.status,
      skipReason: fields.skipReason ?? null,
      resolvedParams: redact(fields.resolvedParams),
      output: fields.output ?? null,
      contextSnapshot: fields.contextSnapshot ?? null,
      errorMessage: fields.errorMessage ?? null,
      errorHint: fields.errorHint ?? null,
      durationMs: fields.durationMs ?? null,
      completedAt: fields.status === "running" ? null : new Date(),
    })
    .returning({ id: nodeExecutionLogs.id });
  return row.id;
}

async function updateLog(
  db: ExecutorDb,
  logId: string,
  fields: LogFields,
): Promise<void> {
  await db
    .update(nodeExecutionLogs)
    .set({
      status: fields.status,
      skipReason: fields.skipReason ?? null,
      output: fields.output ?? null,
      contextSnapshot: fields.contextSnapshot ?? null,
      errorMessage: fields.errorMessage ?? null,
      errorHint: fields.errorHint ?? null,
      durationMs: fields.durationMs ?? null,
      completedAt: new Date(),
    })
    .where(eq(nodeExecutionLogs.id, logId));
}

/** The existing `running` row for this node in this run, if any. */
async function findRunningLog(
  db: ExecutorDb,
  executionId: string,
  nodeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: nodeExecutionLogs.id })
    .from(nodeExecutionLogs)
    .where(
      and(
        eq(nodeExecutionLogs.executionId, executionId),
        eq(nodeExecutionLogs.nodeId, nodeId),
        eq(nodeExecutionLogs.status, "running"),
      ),
    );
  return row !== undefined;
}

/**
 * `resolvedParams` is stored on every row because it answers roughly 95% of
 * "why did this happen" — but it is the *resolved* value, so anything secret a
 * variable pulled in would be stored in plain text next to it.
 *
 * Nothing in the P3 node set has a secret field. The redactor exists now
 * because the first node that does (a webhook's auth header, P9) must not be
 * the moment somebody remembers.
 */
const SECRET_KEYS = /^(password|secret|token|apiKey|authorization|bearer)$/i;

function redact(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!params) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] = SECRET_KEYS.test(key) ? "[redacted]" : value;
  }
  return out;
}
