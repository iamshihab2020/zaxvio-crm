/**
 * Graph validation, server side.
 *
 * The structural rules — no trigger, orphan, missing field, dangling edge,
 * subject mismatch — are **not** here. They live in
 * `@hvac-saas/workflow-nodes/graph/validate`, because the builder has to apply
 * exactly the same ones and cannot import from `apps/api`. Two validators would
 * disagree, and the one the user sees would be the wrong one.
 *
 * This module is the half that cannot be pure: *"a node config references a row
 * this tenant does not own"* ([[wf-08-builder-frontend|§8.7]]). It needs the
 * database, so it wraps the pure validator and appends.
 */

import {
  getDefinition,
  getOwnershipProperties,
  isNamedWorkflow,
  validateGraph,
  type GraphIssue,
  type GraphValidation,
  type ValidatableGraph,
} from "@hvac-saas/workflow-nodes";
import type { getDb } from "@hvac-saas/database";
import { assertOwnership, CHECKABLE_OWNERSHIP_KINDS } from "../engine/ownership.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Full validation: the shared structural rules plus the tenant-ownership pass.
 *
 * Ownership is checked **at save and publish** as well as at execution, and
 * both are needed for different reasons. Here, so the author is told which step
 * is wrong while they are looking at it; at execution, because rows get deleted
 * and automations get duplicated between the two moments.
 */
export async function validateGraphForTenant(
  db: Db,
  tenantId: string,
  graph: ValidatableGraph,
  /**
   * The automation's name. Checked here rather than in `publishWorkflow`
   * because **every caller must get the same answer.**
   *
   * It lived in the publish path alone at first, and that broke the one
   * invariant the client depends on: `api-fetch` nulls `data` on a non-2xx, so
   * a refused publish re-reads its problem list from `GET /:id/validate`. With
   * the name rule in only one of the two, publish refused an unnamed automation
   * and the dialog then fetched a list that had nothing in it — "There are 0
   * things to fix first."
   *
   * Optional so a caller that genuinely has no name to check can skip it, but
   * both real callers pass one.
   */
  workflowName?: string | null,
): Promise<GraphValidation> {
  const base = validateGraph(graph);
  const ownershipIssues = await checkOwnership(db, tenantId, graph);

  // The name is not part of the graph, so the pure validator cannot see it.
  // Enforced at publish, never at save: a draft may be called anything, and a
  // Save that refuses work is a Save that loses it. But an automation about to
  // start emailing customers has to be identifiable in a list and a run log.
  const nameIssues: GraphIssue[] =
    workflowName === undefined || isNamedWorkflow(workflowName)
      ? []
      : [
          {
            severity: "error",
            code: "default_name",
            message:
              "Give this automation a name before publishing it — you'll need " +
              "to recognise it in the list and in its run history.",
          },
        ];

  return {
    errors: [...nameIssues, ...base.errors, ...ownershipIssues],
    warnings: base.warnings,
  };
}

/**
 * Every property declaring an `ownership` kind, checked against this tenant.
 *
 * Deliberately sequential per distinct id rather than one query per property:
 * a graph can hold the same `pipelineId` in six nodes, and the check is a
 * primary-key lookup. Dedupe first, then check — a 60-node graph with a picker
 * on every node is otherwise 60 round trips to answer 3 questions.
 */
async function checkOwnership(
  db: Db,
  tenantId: string,
  graph: ValidatableGraph,
): Promise<GraphIssue[]> {
  /** `${kind}:${id}` → the nodes that reference it, so every one gets an issue. */
  const references = new Map<
    string,
    { kind: string; id: string; sites: { nodeId: string; field: string }[] }
  >();

  for (const node of graph.nodes) {
    const def = getDefinition(node.nodeType);
    if (!def) continue;                       // already reported by the pure pass
    const parameters = node.nodeConfig.parameters ?? {};

    for (const property of getOwnershipProperties(def)) {
      const kind = property.ownership!;
      // Skip what we cannot judge. `assertOwnership` returns false for a kind
      // with no checker — correct for the engine, wrong here, where it would
      // read to the author as "you do not own this" and could not be fixed.
      if (!CHECKABLE_OWNERSHIP_KINDS.has(kind)) continue;

      const raw = parameters[property.name];
      // An unset picker is a *missing required field* if it is required, and
      // legitimately empty otherwise. Either way it is not an ownership problem.
      if (typeof raw !== "string" || raw === "") continue;

      const key = `${kind}:${raw}`;
      const existing = references.get(key);
      const site = { nodeId: node.id, field: property.name };
      if (existing) existing.sites.push(site);
      else references.set(key, { kind, id: raw, sites: [site] });
    }
  }

  const issues: GraphIssue[] = [];
  for (const { kind, id, sites } of references.values()) {
    const owned = await assertOwnership(db, tenantId, kind, id);
    if (owned) continue;
    for (const site of sites) {
      issues.push({
        severity: "error",
        code: "unowned_reference",
        // Plain language, and honest about both possibilities — the row is far
        // more often deleted than foreign, and telling a user they referenced
        // another workspace's data when they simply deleted a pipeline is worse
        // than saying nothing.
        message:
          `This step points at a ${readable(kind)} that no longer exists in this ` +
          `workspace. Choose a different one.`,
        nodeId: site.nodeId,
        field: site.field,
      });
    }
  }
  return issues;
}

function readable(kind: string): string {
  switch (kind) {
    case "member":
      return "team member";
    case "pipeline":
      return "pipeline";
    case "stage":
      return "stage";
    case "catalogItem":
      return "catalog item";
    case "maintenance_contract":
      return "service agreement";
    default:
      return kind.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase();
  }
}
