import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  getDb,
  workflowWebhooks,
  and,
  desc,
  eq,
} from "@hvac-saas/database";
import { requireTenant } from "../../lib/auth-middleware.js";
import { idParam } from "../../lib/schemas/common.js";
import {
  createWebhookBody,
  webhookParam,
  updateWebhookBody,
} from "../../lib/schemas/workflows.js";
import {
  hashSecret,
  mintPathToken,
  mintSecret,
  secretHint,
} from "../../services/workflow/webhooks/secrets.js";
import { loadWorkflowWithGraph } from "../../services/workflow/graph/load.js";

/**
 * Managing inbound webhook endpoints. P9.
 *
 * A sibling plugin under `/workflows`, like `graph.ts` and `runs.ts`, so
 * `routes/workflows/index.ts` does not become the next 2,497-line file.
 *
 * ## The secret is returned exactly once
 *
 * On create, and on rotate. Never on a list, never on a read — those get the
 * four-character hint and nothing else. That is not a UI convention, it is the
 * reason the column stores a hash: an endpoint that could re-display its secret
 * would have to store the secret, and then a database leak is a leak of every
 * tenant's ability to fire their own automations.
 *
 * The response says so in a field the client cannot ignore, because "copy this
 * now" is only true if the UI knows it is only true once.
 */
const workflowWebhookRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /workflows/:id/webhooks
   *
   * Never returns a secret. `secretHint` is the last four characters, which is
   * what makes two endpoints on one automation distinguishable — a list where
   * every row says "••••" is a list nobody can act on.
   */
  fastify.get(
    "/:id/webhooks",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Scoped through the workflow, so an id this tenant does not own 404s
      // before anything is read — rather than returning an empty list, which
      // would confirm the id exists.
      const workflow = await loadWorkflowWithGraph(db, tenantId, request.params.id);
      if (!workflow) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const rows = await db
        .select({
          id: workflowWebhooks.id,
          pathToken: workflowWebhooks.pathToken,
          authMode: workflowWebhooks.authMode,
          secretHint: workflowWebhooks.secretHint,
          description: workflowWebhooks.description,
          isActive: workflowWebhooks.isActive,
          lastReceivedAt: workflowWebhooks.lastReceivedAt,
          receivedCount: workflowWebhooks.receivedCount,
          createdAt: workflowWebhooks.createdAt,
        })
        .from(workflowWebhooks)
        .where(
          and(
            eq(workflowWebhooks.tenantId, tenantId),
            eq(workflowWebhooks.workflowId, request.params.id),
          ),
        )
        .orderBy(desc(workflowWebhooks.createdAt));

      return reply.send({ data: rows });
    },
  );

  /**
   * POST /workflows/:id/webhooks
   *
   * Returns the secret **in full, once**. Everything after this returns the hint.
   */
  fastify.post(
    "/:id/webhooks",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: createWebhookBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const workflow = await loadWorkflowWithGraph(db, tenantId, request.params.id);
      if (!workflow) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const authMode = request.body.authMode ?? "secret";
      const secret = authMode === "none" ? null : mintSecret();

      const [row] = await db
        .insert(workflowWebhooks)
        .values({
          tenantId,
          workflowId: request.params.id,
          pathToken: mintPathToken(),
          authMode,
          secretHash: secret ? hashSecret(secret) : null,
          secretHint: secret ? secretHint(secret) : null,
          description: request.body.description ?? null,
          createdBy: request.authUser.userId,
        })
        .returning({
          id: workflowWebhooks.id,
          pathToken: workflowWebhooks.pathToken,
          authMode: workflowWebhooks.authMode,
          secretHint: workflowWebhooks.secretHint,
        });

      return reply.status(201).send({
        data: {
          ...row,
          // The only response that ever carries this. Named `secretShownOnce`
          // rather than `secret` so a client cannot treat it as a field it can
          // re-fetch — the name is the documentation at the call site.
          secretShownOnce: secret,
        },
      });
    },
  );

  /**
   * POST /workflows/:id/webhooks/:webhookId/rotate
   *
   * Mints a new secret and returns it once. The **path token does not change**,
   * so an integration that is already configured keeps working the moment its
   * owner updates the secret — rotating the URL as well would mean every
   * rotation is an outage until somebody edits the sending system twice.
   */
  fastify.post(
    "/:id/webhooks/:webhookId/rotate",
    { preHandler: [requireTenant], schema: { params: webhookParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const secret = mintSecret();

      const [row] = await db
        .update(workflowWebhooks)
        .set({
          secretHash: hashSecret(secret),
          secretHint: secretHint(secret),
          // Rotating onto an endpoint that was `none` turns authentication on,
          // which is the safe direction and the one somebody rotating means.
          authMode: "secret",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflowWebhooks.tenantId, tenantId),
            eq(workflowWebhooks.workflowId, request.params.id),
            eq(workflowWebhooks.id, request.params.webhookId),
          ),
        )
        .returning({
          id: workflowWebhooks.id,
          pathToken: workflowWebhooks.pathToken,
          secretHint: workflowWebhooks.secretHint,
        });

      if (!row) {
        return reply.status(404).send({ message: "Webhook not found" });
      }

      return reply.send({ data: { ...row, secretShownOnce: secret } });
    },
  );

  /** PATCH — switch one off, or retitle it. Never touches the secret. */
  fastify.patch(
    "/:id/webhooks/:webhookId",
    {
      preHandler: [requireTenant],
      schema: { params: webhookParam, body: updateWebhookBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;

      const [row] = await getDb()
        .update(workflowWebhooks)
        .set({
          ...(request.body.description !== undefined
            ? { description: request.body.description }
            : {}),
          ...(request.body.isActive !== undefined
            ? { isActive: request.body.isActive }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflowWebhooks.tenantId, tenantId),
            eq(workflowWebhooks.workflowId, request.params.id),
            eq(workflowWebhooks.id, request.params.webhookId),
          ),
        )
        .returning({
          id: workflowWebhooks.id,
          isActive: workflowWebhooks.isActive,
          description: workflowWebhooks.description,
        });

      if (!row) {
        return reply.status(404).send({ message: "Webhook not found" });
      }

      return reply.send({ data: row });
    },
  );

  /**
   * DELETE — permanent, and the URL stops working immediately.
   *
   * No archive state. A webhook is a credential; "switched off but recoverable"
   * is a category that does not apply to something whose only purpose is to be
   * callable, and `isActive` already covers pausing one.
   */
  fastify.delete(
    "/:id/webhooks/:webhookId",
    { preHandler: [requireTenant], schema: { params: webhookParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;

      const rows = await getDb()
        .delete(workflowWebhooks)
        .where(
          and(
            eq(workflowWebhooks.tenantId, tenantId),
            eq(workflowWebhooks.workflowId, request.params.id),
            eq(workflowWebhooks.id, request.params.webhookId),
          ),
        )
        .returning({ id: workflowWebhooks.id });

      if (rows.length === 0) {
        return reply.status(404).send({ message: "Webhook not found" });
      }

      return reply.send({ data: { id: rows[0].id } });
    },
  );
};

export default workflowWebhookRoutes;
