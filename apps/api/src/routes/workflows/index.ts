/**
 * Workflow routes — the automation record itself.
 *
 * `POST /:id/runs` and `GET /quota` landed in P3; the CRUD around them is P5,
 * because a builder needs something to build *into*. The graph endpoints —
 * save, publish, validate, versions — are a sibling plugin in `graph.ts` under
 * this same prefix, so this file does not become the next `routes/jobs/index.ts`
 * ([[architecture|ARC-05]]).
 *
 * `POST /:id/runs` exists for one reason — an engine nothing can reach is an
 * engine nothing can prove. It is also what a tenant uses to try an automation
 * on a real record before switching it on.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  getDb,
  workflows,
  workflowVersions,
  and,
  eq,
  desc,
  count,
  ilike,
  isNull,
  isNotNull,
} from "@hvac-saas/database";
import { requireTenant } from "../../lib/auth-middleware.js";
import { idParam } from "../../lib/schemas/common.js";
import {
  createFromTemplateBody,
  createWorkflowBody,
  runWorkflowBody,
  setWorkflowActiveBody,
  updateWorkflowBody,
  workflowListQuery,
} from "../../lib/schemas/workflows.js";
import { getTemplate } from "@hvac-saas/workflow-nodes";
import type { WorkflowGraph } from "@hvac-saas/types";
import { containsPattern } from "../../lib/search.js";
import { execute } from "../../services/workflow/engine/execute.js";
import { getQuotaUsage } from "../../services/workflow/engine/quotas.js";
import {
  loadActiveVersion,
  loadWorkflowWithGraph,
} from "../../services/workflow/graph/load.js";
import { isDraftDirty } from "../../services/workflow/graph/publish.js";
import { instantiateTemplate } from "../../services/workflow/templates/instantiate.js";

/**
 * Running an automation is not free — it can send email — so this is tighter
 * than the global bucket. Ten a minute is far more than a person clicks Run and
 * far fewer than a script sweeping a customer list ([[security-rules]] §4).
 */
const RUN_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

const workflowRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * POST /workflows/:id/runs
   * Run an automation by hand against one record.
   */
  fastify.post(
    "/:id/runs",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: runWorkflowBody },
      config: { rateLimit: RUN_LIMIT },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const body = request.body ?? {};

      const result = await execute({
        // **From the session, never from the body** (D-16). A tenant id in a
        // request body is the whole of multi-tenancy handed to the caller.
        tenantId,
        workflowId: id,
        versionId: body.versionId,
        subject: body.subject ?? null,
        source: "manual",
        actorUserId: request.authUser.userId,
      });

      // `refused` is a 400 with the reason already written for a person — over
      // quota, no published version, no trigger. Every one of these is
      // something the tenant can act on, which is why none of them is a 500.
      if (result.status === "refused") {
        return reply.status(400).send({ message: result.reason });
      }

      // Already running for this record. Not an error: the correct response to
      // a second enrolment is to leave the first one alone (D-03).
      if (result.status === "duplicate") {
        return reply.status(409).send({ message: result.reason });
      }

      return reply.status(201).send({
        data: {
          executionId: result.executionId,
          status: result.status,
          reason: result.reason,
          nodesExecuted: result.nodesExecuted,
          // Unresolved variables surface **to the user**, next to the run, not
          // only in a server log they cannot read. A blank email is otherwise
          // the least debuggable thing this feature produces.
          diagnostics: result.diagnostics,
        },
      });
    },
  );

  /**
   * GET /workflows/quota
   *
   * Quotas are surfaced **before** they are enforced. A tenant who can see
   * "142 of 2,000 today" never meets the cap by surprise; a silent cap is a
   * support ticket.
   */
  fastify.get(
    "/quota",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const usage = await getQuotaUsage(getDb(), request.authUser.tenantId!);
      return reply.send({ data: usage });
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────────────────────────────────

  /** GET /workflows — the automations list page. */
  fastify.get(
    "/",
    { preHandler: [requireTenant], schema: { querystring: workflowListQuery } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { page, limit, search, showArchived, isActive, folderId } = request.query;
      const offset = (page - 1) * limit;

      const filters = [
        eq(workflows.tenantId, tenantId),
        showArchived ? isNotNull(workflows.archivedAt) : isNull(workflows.archivedAt),
      ];
      // `containsPattern` escapes `%` and `_`; an unescaped ilike pattern lets a
      // search for "50%" match everything ([[invoices|INV-10]], swept repo-wide).
      if (search) filters.push(ilike(workflows.name, containsPattern(search)));
      if (isActive !== undefined) filters.push(eq(workflows.isActive, isActive));
      if (folderId) filters.push(eq(workflows.folderId, folderId));

      const where = and(...filters);

      const [data, totalResult] = await Promise.all([
        getDb()
          .select({
            id: workflows.id,
            tenantId: workflows.tenantId,
            name: workflows.name,
            description: workflows.description,
            isActive: workflows.isActive,
            activeVersionId: workflows.activeVersionId,
            folderId: workflows.folderId,
            timezoneMode: workflows.timezoneMode,
            timezone: workflows.timezone,
            templateKey: workflows.templateKey,
            createdBy: workflows.createdBy,
            createdAt: workflows.createdAt,
            updatedAt: workflows.updatedAt,
            archivedAt: workflows.archivedAt,
            // What each automation actually IS, so the list is an index rather
            // than a column of names. All three are already denormalised onto
            // the version row — `trigger_types` for the matcher, `node_count`
            // for the version history — so this costs one join, not a subquery
            // per row.
            version: workflowVersions.version,
            nodeCount: workflowVersions.nodeCount,
            triggerTypes: workflowVersions.triggerTypes,
          })
          .from(workflows)
          // LEFT: an unpublished automation has no version and must still
          // appear. An inner join would silently hide every draft.
          .leftJoin(
            workflowVersions,
            eq(workflowVersions.id, workflows.activeVersionId),
          )
          .where(where)
          .orderBy(desc(workflows.updatedAt))
          .limit(limit)
          .offset(offset),
        getDb().select({ total: count() }).from(workflows).where(where),
      ]);

      const total = totalResult[0]?.total ?? 0;
      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  /**
   * POST /workflows
   *
   * Creates the record only — no nodes. A new automation opens on the template
   * gallery rather than a blank canvas ([[wf-08-builder-frontend|O-1]]), and the
   * chosen template is installed by the graph PUT, so creation has exactly one
   * job and templates need no second code path.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant], schema: { body: createWorkflowBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      const [created] = await getDb()
        .insert(workflows)
        .values({
          tenantId,
          name: body.name,
          description: body.description ?? null,
          folderId: body.folderId ?? null,
          timezoneMode: body.timezoneMode,
          timezone: body.timezone ?? null,
          templateKey: body.templateKey ?? null,
          createdBy: request.authUser.userId,
          // isActive stays false. A drawing tool that starts emailing customers
          // the moment a trigger lands on the canvas is a bad idea.
        })
        .returning();

      return reply.status(201).send({ data: created });
    },
  );

  /**
   * POST /workflows/from-template
   *
   * Install one of the shipped templates as a new draft automation.
   *
   * The body carries a template **id**, never a graph. The client imports the
   * same catalogue and could send the nodes — which is exactly why it must not:
   * a graph accepted from the browser is a graph the browser can change, and
   * "install this template" would quietly become "write me any automation you
   * like, including one that emails every customer".
   *
   * Created off and unpublished, like every other automation.
   */
  fastify.post(
    "/from-template",
    { preHandler: [requireTenant], schema: { body: createFromTemplateBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { templateId, name } = request.body;

      const template = getTemplate(templateId);
      if (!template) {
        return reply.status(404).send({ message: "Template not found" });
      }

      const result = await instantiateTemplate({
        tenantId,
        template,
        name,
        createdByUserId: request.authUser.userId,
      });

      if (result.status === "invalid") {
        return reply.status(422).send({ message: result.reason });
      }

      return reply.status(201).send({ data: { id: result.workflowId } });
    },
  );

  /** GET /workflows/:id — the record, its draft graph, and the toolbar state. */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const loaded = await loadWorkflowWithGraph(getDb(), tenantId, request.params.id);
      if (!loaded) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const activeVersion = await loadActiveVersion(getDb(), tenantId, loaded.workflow);

      return reply.send({
        data: {
          workflow: loaded.workflow,
          graph: loaded.graph,
          activeVersion: activeVersion
            ? {
                id: activeVersion.id,
                version: activeVersion.version,
                publishedAt: activeVersion.publishedAt,
                note: activeVersion.note,
              }
            : null,
          // `workflow_versions.graph` is jsonb, so Drizzle types it `unknown`.
          // Asserted to the named type, never to `any` ([[strict-rules]] §4) —
          // this is the one boundary where the snapshot's shape is declared.
          isDirty: isDraftDirty(
            loaded.graph,
            activeVersion ? (activeVersion.graph as WorkflowGraph) : null,
          ),
        },
      });
    },
  );

  /** PATCH /workflows/:id — name, description, folder, timezone. Not the switch. */
  fastify.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateWorkflowBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      const [updated] = await getDb()
        .update(workflows)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description ?? null }),
          ...(body.folderId !== undefined && { folderId: body.folderId ?? null }),
          ...(body.timezoneMode !== undefined && { timezoneMode: body.timezoneMode }),
          ...(body.timezone !== undefined && { timezone: body.timezone ?? null }),
          updatedAt: new Date(),
        })
        .where(
          and(eq(workflows.tenantId, tenantId), eq(workflows.id, request.params.id)),
        )
        .returning();

      if (!updated) {
        return reply.status(404).send({ message: "Automation not found" });
      }
      return reply.send({ data: updated });
    },
  );

  /**
   * POST /workflows/:id/active — the on/off switch.
   *
   * Its own endpoint rather than a field on PATCH, because it carries a rule no
   * other field does: **an automation with nothing published cannot be switched
   * on.** `is_active` without an `active_version_id` is a workflow the trigger
   * matcher would find and then have no graph to run.
   */
  fastify.post(
    "/:id/active",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: setWorkflowActiveBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const [workflow] = await db
        .select()
        .from(workflows)
        .where(
          and(eq(workflows.tenantId, tenantId), eq(workflows.id, request.params.id)),
        );

      if (!workflow) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      if (request.body.isActive && !workflow.activeVersionId) {
        return reply.status(400).send({
          message:
            "Publish this automation before switching it on — there is nothing " +
            "for it to run yet.",
        });
      }

      if (request.body.isActive && workflow.archivedAt) {
        return reply.status(400).send({
          message: "This automation is archived. Restore it before switching it on.",
        });
      }

      const [updated] = await db
        .update(workflows)
        .set({ isActive: request.body.isActive, updatedAt: new Date() })
        .where(
          and(eq(workflows.tenantId, tenantId), eq(workflows.id, request.params.id)),
        )
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /workflows/:id — archives, and switches off on the way.
   *
   * Archive rather than delete: `workflow_executions` cascades from this row, so
   * a hard delete destroys the run history — which is the record of every email
   * this automation ever sent to a customer. Switching off is part of the same
   * write, because an archived automation that keeps firing is the worst
   * possible reading of "delete".
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const [archived] = await getDb()
        .update(workflows)
        .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(workflows.tenantId, request.authUser.tenantId!),
            eq(workflows.id, request.params.id),
            isNull(workflows.archivedAt),
          ),
        )
        .returning();

      if (!archived) {
        return reply
          .status(404)
          .send({ message: "Automation not found, or already archived" });
      }
      return reply.send({ message: "Automation archived" });
    },
  );
};

export default workflowRoutes;
