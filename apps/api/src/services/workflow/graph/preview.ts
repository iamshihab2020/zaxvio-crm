/**
 * "Test this step" — resolve one node's settings against a real record.
 *
 * ## It resolves. It does not run.
 *
 * The obvious reading of "test this step" is "execute it", and that is the
 * wrong thing to build first. Half the steps in the catalogue are
 * `at-most-once`: testing `email.send` by running it puts a real message in a
 * customer's inbox, and a test button that mails customers is one people learn
 * not to press. Which makes it worse than no button.
 *
 * What actually goes wrong with a step is almost never the executor — it is the
 * **configuration**: a mistyped `{{customer.frstName}}`, a variable the trigger
 * cannot provide, a subject that comes out blank. Every one of those is visible
 * without side effects, by resolving the parameters and showing what comes out.
 * That is what this returns, alongside the diagnostics the interpolator already
 * produces for unresolved tokens.
 *
 * Running a step for real belongs with the run viewer in P8, where there is
 * somewhere to show what it did and a way to see what it changed.
 *
 * It previews the **draft**, not the published version: the point is to check
 * what you are editing, before deciding it is worth publishing.
 */

import { getDefinition, type SubjectType } from "@hvac-saas/workflow-nodes";
import { workflows, and, eq, isNull, type getDb } from "@hvac-saas/database";
import { loadExecutionContext } from "../engine/context.js";
import { resolveTimezone } from "../engine/execute.js";
import { interpolateParameters, type Diagnostic } from "../engine/interpolate.js";
import { SubjectGone } from "../engine/errors.js";
import { loadDraftGraph } from "./load.js";

type Db = ReturnType<typeof getDb>;

export interface PreviewParams {
  db: Db;
  tenantId: string;
  workflowId: string;
  nodeId: string;
  subject: { type: SubjectType; id: string } | null;
}

export type PreviewResult =
  | {
      status: "ok";
      /** Every setting with its `{{tokens}}` resolved, ready to read. */
      parameters: Record<string, unknown>;
      diagnostics: Diagnostic[];
    }
  | { status: "not_found"; message: string }
  | { status: "subject_gone"; message: string };

export async function previewNode(params: PreviewParams): Promise<PreviewResult> {
  const { db, tenantId, workflowId, nodeId } = params;

  const [workflow] = await db
    .select({
      id: workflows.id,
      name: workflows.name,
      activeVersionId: workflows.activeVersionId,
      timezoneMode: workflows.timezoneMode,
      timezone: workflows.timezone,
    })
    .from(workflows)
    .where(
      and(
        eq(workflows.tenantId, tenantId),
        eq(workflows.id, workflowId),
        isNull(workflows.archivedAt),
      ),
    );

  if (!workflow) {
    return { status: "not_found", message: "Automation not found" };
  }

  const graph = await loadDraftGraph(db, tenantId, workflowId);
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return {
      status: "not_found",
      message: "That step is not part of this automation — save and try again.",
    };
  }

  const definition = getDefinition(node.nodeType);
  if (!definition) {
    return { status: "not_found", message: "That kind of step is no longer available." };
  }

  // The same resolution order a real run uses: workflow zone → tenant zone →
  // default, never the server's. A preview that formatted dates differently
  // from the run it is previewing would be worse than no preview.
  const timezone = await resolveTimezone(
    db,
    tenantId,
    workflow.timezoneMode,
    workflow.timezone,
  );

  let ctx;
  try {
    ctx = await loadExecutionContext(db, {
      tenantId,
      workflowId,
      workflowName: workflow.name,
      // A preview belongs to no version and no execution. These are carried by
      // the context only so `{{...}}` paths that reference them resolve to
      // *something* readable rather than to an empty string, which would look
      // like a broken variable rather than like a preview.
      versionId: workflow.activeVersionId ?? PREVIEW_SENTINEL,
      executionId: PREVIEW_SENTINEL,
      timezone,
      subject: params.subject,
      // No event: a preview is not triggered by anything. Trigger-scoped
      // variables resolve empty and are reported as diagnostics, which is the
      // honest answer — they genuinely would be empty on a manual run too.
      trigger: { event: null, payload: {} },
    });
  } catch (error) {
    if (error instanceof SubjectGone) {
      return {
        status: "subject_gone",
        message: "That record no longer exists, so there is nothing to preview against.",
      };
    }
    throw error;
  }

  // `noInterpolate` fields are skipped for the same reason the engine skips
  // them: their braces belong to something else.
  const skip = new Set(
    definition.properties.filter((p) => p.noInterpolate).map((p) => p.name),
  );
  const encodings = Object.fromEntries(
    definition.properties
      .filter((p) => p.encoding)
      .map((p) => [p.name, p.encoding] as const),
  );

  const { value, diagnostics } = interpolateParameters(
    node.nodeConfig.parameters ?? {},
    ctx,
    { skip, encodings },
  );

  return { status: "ok", parameters: value, diagnostics };
}

/** Readable in a preview, and obviously not a real id if one leaks into output. */
const PREVIEW_SENTINEL = "00000000-0000-0000-0000-000000000000";
