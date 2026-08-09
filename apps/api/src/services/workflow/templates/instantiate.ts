/**
 * Turning a template into somebody's automation.
 *
 * The whole of it is one transaction: a workflow row, its nodes, its edges. A
 * partial instantiation — the workflow created and the graph half-written — is
 * an automation the tenant did not ask for, and worse, one that looks like
 * something they abandoned.
 *
 * ## What it deliberately does not do
 *
 * **It does not publish, and it does not switch on.** A template is a starting
 * point, and the product's rule is that nothing starts emailing customers until
 * somebody deliberately turns it on. Instantiating straight to live would be the
 * one place in the product where that stopped being true, and it would do it
 * with prewritten copy the tenant has not read.
 *
 * **It does not fill in tenant-scoped ids.** No template uses a node that needs
 * a pipeline, a stage or a teammate, precisely so this never has to guess one.
 */

import {
  getDb,
  workflows,
  workflowNodes,
  workflowEdges,
} from "@hvac-saas/database";
import { randomUUID } from "node:crypto";
import {
  buildNodeConfig,
  getDefinition,
  layoutTemplate,
  type WorkflowTemplate,
} from "@hvac-saas/workflow-nodes";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface InstantiateParams {
  db?: Db;
  tenantId: string;
  template: WorkflowTemplate;
  /** The tenant may rename it in the dialog before creating. */
  name?: string;
  createdByUserId: string;
}

export type InstantiateResult =
  | { status: "created"; workflowId: string }
  | { status: "invalid"; reason: string };

export async function instantiateTemplate(
  params: InstantiateParams,
): Promise<InstantiateResult> {
  const db = params.db ?? getDb();
  const { template, tenantId } = params;

  // A template naming a node this build does not have is a packaging mistake,
  // not a tenant error — but it must not produce a half-built automation, so it
  // is caught before anything is written rather than surfacing as an
  // `unknown_node_type` the tenant is asked to fix.
  const unknown = template.nodes
    .filter((node) => !getDefinition(node.nodeType))
    .map((node) => node.nodeType);
  if (unknown.length > 0) {
    return {
      status: "invalid",
      reason: `This template uses steps this version doesn't have: ${unknown.join(", ")}.`,
    };
  }

  const positioned = layoutTemplate(template);

  // Local key → fresh UUID. Minted per instantiation, because node id is what an
  // edge stores and what a run log points at: two automations from one template
  // sharing ids would make each other's history ambiguous.
  const idFor = new Map<string, string>();
  for (const node of positioned) idFor.set(node.key, randomUUID());

  const workflowId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(workflows).values({
      id: workflowId,
      tenantId,
      name: params.name?.trim() || template.name,
      description: template.summary,
      // Off, and unpublished. See the header — this is the product's rule, not
      // a conservative default.
      isActive: false,
      createdBy: params.createdByUserId,
      // The schema anticipated this column and its comment says what it is for:
      // "so the gallery can say installed". Not unique — installing the same
      // template twice and editing each copy differently is legitimate.
      templateKey: template.id,
    });

    await tx.insert(workflowNodes).values(
      positioned.map((node) => ({
        id: idFor.get(node.key)!,
        // From the session, never from the payload (D-16).
        tenantId,
        workflowId,
        nodeType: node.nodeType,
        // Through `buildNodeConfig`, so a node created from a template carries
        // exactly the same defaults as one dragged from the palette — including
        // any property the template did not mention. Writing `parameters`
        // straight through would produce nodes missing their own defaults, which
        // surfaces much later as a required field that was never empty on screen.
        nodeConfig: buildNodeConfig(getDefinition(node.nodeType)!, {
          label: node.label,
          parameters: node.parameters,
        }),
        positionX: Math.trunc(node.positionX),
        positionY: Math.trunc(node.positionY),
      })),
    );

    if (template.edges.length > 0) {
      await tx.insert(workflowEdges).values(
        template.edges.map((edge) => ({
          id: randomUUID(),
          tenantId,
          workflowId,
          sourceNodeId: idFor.get(edge.from)!,
          // A stable output id, never a display label (D-07).
          sourceHandle: edge.fromHandle ?? "main",
          targetNodeId: idFor.get(edge.to)!,
          label: null,
        })),
      );
    }
  });

  return { status: "created", workflowId };
}
