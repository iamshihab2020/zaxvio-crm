/**
 * Builder graph endpoints — save, publish, validate, version history.
 *
 * A **sibling plugin** under the same `/workflows` prefix rather than more
 * lines in `index.ts`, following `routes/jobs/costing.ts`. `routes/jobs/index.ts`
 * reached 2,497 lines and is [[architecture|ARC-05]]'s target; the way that
 * happens is one reasonable addition at a time, so the split goes in on the
 * first addition rather than the fifteenth.
 *
 * Handlers stay thin ([[api-rules]] §1): validate, call the service, map its
 * result to a status code. Every rule about what a graph may contain lives in
 * `services/workflow/graph/`.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { getDb, workflowVersions, and, eq, desc } from "@hvac-saas/database";
import { requireTenant } from "../../lib/auth-middleware.js";
import { idParam } from "../../lib/schemas/common.js";
import {
  nodeParam,
  previewNodeBody,
  publishWorkflowBody,
  restoreVersionBody,
  recordSearchQuery,
  saveGraphBody,
  versionParam,
} from "../../lib/schemas/workflows.js";
import { loadWorkflowWithGraph, loadActiveVersion } from "../../services/workflow/graph/load.js";
import { loadBuilderContext } from "../../services/workflow/graph/builder-context.js";
import { searchRecords } from "../../services/workflow/graph/record-search.js";
import { previewNode } from "../../services/workflow/graph/preview.js";
import { saveGraph } from "../../services/workflow/graph/persist.js";
import { publishWorkflow } from "../../services/workflow/graph/publish.js";
import { validateGraphForTenant } from "../../services/workflow/graph/validate.js";
import { restoreVersion } from "../../services/workflow/graph/restore.js";

const workflowGraphRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * PUT /workflows/:id/graph
   *
   * Whole-graph save. Never changes what runs — that is Publish.
   */
  fastify.put(
    "/:id/graph",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: saveGraphBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const { nodes, edges, expectedUpdatedAt } = request.body;

      const result = await saveGraph({
        db: getDb(),
        tenantId,
        workflowId: id,
        nodes,
        edges,
        expectedUpdatedAt,
      });

      if (result.status === "not_found") {
        return reply.status(404).send({ message: "Automation not found" });
      }

      if (result.status === "too_large") {
        return reply.status(400).send({
          message:
            `This automation has ${result.received} steps and the limit is ` +
            `${result.limit}. Split it into two automations.`,
        });
      }

      // 409, never a silent clobber (S-6). The current timestamp goes back with
      // it so the client can offer Reload without a second round trip.
      if (result.status === "conflict") {
        return reply.status(409).send({
          message:
            "Someone else edited this automation while you were working on it. " +
            "Reload to see their changes — your version has not been saved.",
          data: { currentUpdatedAt: result.currentUpdatedAt },
        });
      }

      return reply.send({
        data: { updatedAt: result.updatedAt, graph: result.graph },
      });
    },
  );

  /**
   * GET /workflows/:id/validate
   *
   * The same answer Publish would give, without publishing. Lets the builder
   * show the problem list before the user commits to the action, and keeps the
   * client and server verdicts from ever disagreeing.
   */
  fastify.get(
    "/:id/validate",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const loaded = await loadWorkflowWithGraph(getDb(), tenantId, request.params.id);
      if (!loaded) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      // The name goes in too, so this endpoint and the publish path give the
      // same answer. They must: a refused publish re-reads its problem list
      // from here, and a rule in only one of them shows the user an empty list.
      const validation = await validateGraphForTenant(
        getDb(),
        tenantId,
        loaded.graph,
        loaded.workflow.name,
      );
      return reply.send({
        data: { ...validation, canPublish: validation.errors.length === 0 },
      });
    },
  );

  /**
   * POST /workflows/:id/publish
   *
   * Snapshots the draft, bumps the version, points `active_version_id` at it,
   * and writes `trigger_types` — which is what makes the automation visible to
   * the trigger matcher at all.
   */
  fastify.post(
    "/:id/publish",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: publishWorkflowBody },
    },
    async (request, reply) => {
      const result = await publishWorkflow({
        db: getDb(),
        tenantId: request.authUser.tenantId!,
        workflowId: request.params.id,
        publishedBy: request.authUser.userId,
        note: request.body?.note ?? null,
      });

      if (result.status === "not_found") {
        return reply.status(404).send({ message: "Automation not found" });
      }

      // 422 rather than 400: the request was well formed, the graph is not.
      // The validation payload comes back whole so the dialog can list every
      // problem and select the node behind each one (S-4).
      if (result.status === "invalid") {
        return reply.status(422).send({
          message: "This automation cannot be published yet.",
          data: result.validation,
        });
      }

      return reply.status(201).send({
        data: {
          id: result.version.id,
          version: result.version.version,
          publishedAt: result.version.publishedAt,
          triggerTypes: result.version.triggerTypes,
          nodeCount: result.version.nodeCount,
          note: result.version.note,
        },
      });
    },
  );

  /**
   * GET /workflows/:id/builder-context
   *
   * Members, pipelines and stages in one request (P-5). Selecting a node would
   * otherwise fire a server action per picker, sequentially, every time.
   *
   * Scoped to `:id` rather than being a bare `/workflows/builder-context` so it
   * 404s for an automation this tenant does not own — the payload is workspace
   * reference data and should not be readable by id-less probing.
   */
  fastify.get(
    "/:id/builder-context",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const loaded = await loadWorkflowWithGraph(getDb(), tenantId, request.params.id);
      if (!loaded) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const context = await loadBuilderContext(getDb(), tenantId, request.params.id);
      return reply.send({ data: context });
    },
  );

  /**
   * GET /workflows/:id/records?kind=customer&q=smith
   *
   * The searchable half of the picker set. `builder-context` ships the closed
   * lists; this one serves customers, jobs, equipment and contracts, which have
   * no ceiling and would make opening a node slower the longer a tenant has
   * been in business.
   *
   * `ids` rather than `q` is the **rehydrate** path: a saved config holds an id
   * and the panel has to render a name for it on open, with no search term to
   * find it by. Without it a configured picker would show a bare uuid — or an
   * empty control, which reads as "nothing is set" on a step that is set.
   *
   * Scoped to `:id` for the same reason as `builder-context`: it 404s for an
   * automation this tenant does not own, so the customer list is not readable
   * by id-less probing.
   */
  fastify.get(
    "/:id/records",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: recordSearchQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const loaded = await loadWorkflowWithGraph(getDb(), tenantId, request.params.id);
      if (!loaded) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const options = await searchRecords(getDb(), {
        tenantId,
        kind: request.query.kind,
        query: request.query.q ?? "",
        ids: request.query.ids,
      });
      return reply.send({ data: options });
    },
  );

  /**
   * POST /workflows/:id/nodes/:nodeId/preview
   *
   * Resolve one step's settings against a real record. **Resolves, does not
   * run** — see `services/workflow/graph/preview.ts` for why a test button that
   * executes `email.send` is worse than no button at all.
   *
   * No rate limit beyond the global one: it writes nothing and sends nothing.
   */
  fastify.post(
    "/:id/nodes/:nodeId/preview",
    {
      preHandler: [requireTenant],
      schema: { params: nodeParam, body: previewNodeBody },
    },
    async (request, reply) => {
      const result = await previewNode({
        db: getDb(),
        tenantId: request.authUser.tenantId!,
        workflowId: request.params.id,
        nodeId: request.params.nodeId,
        subject: request.body?.subject ?? null,
      });

      if (result.status === "not_found") {
        return reply.status(404).send({ message: result.message });
      }
      if (result.status === "subject_gone") {
        return reply.status(400).send({ message: result.message });
      }

      return reply.send({
        data: { parameters: result.parameters, diagnostics: result.diagnostics },
      });
    },
  );

  /**
   * POST /workflows/:id/versions/:versionId/restore
   *
   * Copy an earlier snapshot back over the **draft**.
   *
   * Deliberately does not activate it. Pointing `active_version_id` at the old
   * version would be one column and instant — and it would leave the builder
   * showing one graph while the engine ran another, so the next Save would
   * quietly publish the breakage back. It would also put a version live without
   * anybody looking at it, which is the rule this feature holds everywhere else.
   *
   * The tenant gets the old automation on the canvas, checks it, and presses
   * Publish — which mints a new version. "v5, restored from v2" is true; making
   * v2 current again silently is not.
   */
  fastify.post(
    "/:id/versions/:versionId/restore",
    {
      preHandler: [requireTenant],
      schema: { params: versionParam, body: restoreVersionBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id, versionId } = request.params;

      const result = await restoreVersion({
        db: getDb(),
        tenantId,
        workflowId: id,
        versionId,
        expectedUpdatedAt: new Date(request.body.expectedUpdatedAt),
      });

      if (result.status === "not_found") {
        return reply.status(404).send({ message: "That version no longer exists" });
      }
      if (result.status === "empty") {
        return reply.status(422).send({
          message:
            "That version has no steps in it, so restoring it would leave you with an empty automation.",
        });
      }
      if (result.status === "conflict") {
        return reply.status(409).send({
          message:
            "Somebody else saved this automation while you were looking at it. Reload before restoring.",
          currentUpdatedAt: result.currentUpdatedAt,
        });
      }
      if (result.status === "too_large") {
        return reply.status(413).send({
          message: `That version is too large to restore (${result.received} of ${result.limit}).`,
        });
      }

      return reply.send({
        data: {
          restoredVersion: result.restoredVersion,
          updatedAt: result.updatedAt,
          graph: result.graph,
        },
      });
    },
  );

  /**
   * GET /workflows/:id/versions
   *
   * Version history, newest first. The `graph` column is deliberately **not**
   * selected — it is the whole automation, and a history list that ships fifty
   * snapshots to render fifty rows of "v12 · 3 Aug · Bob" is a payload nobody
   * asked for. Restoring one fetches it by id.
   */
  fastify.get(
    "/:id/versions",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const loaded = await loadWorkflowWithGraph(getDb(), tenantId, request.params.id);
      if (!loaded) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const versions = await getDb()
        .select({
          id: workflowVersions.id,
          version: workflowVersions.version,
          publishedAt: workflowVersions.publishedAt,
          publishedBy: workflowVersions.publishedBy,
          note: workflowVersions.note,
          nodeCount: workflowVersions.nodeCount,
          triggerTypes: workflowVersions.triggerTypes,
        })
        .from(workflowVersions)
        .where(
          and(
            eq(workflowVersions.tenantId, tenantId),
            eq(workflowVersions.workflowId, request.params.id),
          ),
        )
        .orderBy(desc(workflowVersions.version));

      const active = await loadActiveVersion(getDb(), tenantId, loaded.workflow);

      return reply.send({
        data: versions.map((v) => ({ ...v, isActive: v.id === active?.id })),
      });
    },
  );
};

export default workflowGraphRoutes;
