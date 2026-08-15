import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "@hvac-saas/database";
import {
  resolveWebhook,
  recordReceipt,
  buildWebhookPayload,
} from "../../services/workflow/webhooks/receive.js";
import { execute } from "../../services/workflow/engine/execute.js";

/**
 * The public inbound webhook receiver. P9.
 *
 * ## Everything here is untrusted
 *
 * This is the only route in the product that fires an automation with **no
 * session at all**. The tenant is resolved from the path token and from nothing
 * else — never from a header, a body field or a query parameter
 * ([[wf-10-security|T-4]]). That rule is what stops a caller who has one
 * tenant's webhook URL from running another tenant's automation by adding a
 * `tenantId` to their JSON.
 *
 * ## Refusals are indistinguishable
 *
 * Unknown token, switched-off endpoint, archived workflow, wrong secret — all
 * 404, all the same body. The reason is logged and never sent. Probing for
 * valid tokens must not be able to tell "exists but wrong secret" from "does
 * not exist".
 *
 * ## The response says nothing about the run
 *
 * 202, with the execution id and no more. A sender who could see "failed at
 * step 3: no such customer" would be reading the tenant's data through an
 * endpoint that authenticates as *nobody in particular*. The tenant reads that
 * in their own run history.
 */

/** 60 a minute per endpoint. In-process — correct at one instance, and the
 *  documented place to swap in Redis when there is more than one. */
const WEBHOOK_LIMIT = { max: 60, timeWindow: "1 minute" };

/**
 * 256 KB.
 *
 * Derived from the payload cap the receiver enforces (64 KB) with room for the
 * envelope, rather than picked. The two numbers moving independently is the
 * JOB-04 defect: a route advertising one ceiling and enforcing another means a
 * request dies at the parser with a message nobody can act on.
 */
const WEBHOOK_BODY_LIMIT = 256 * 1024;

const webhookParams = z.object({
  token: z.string().min(16).max(64),
});

/**
 * Where the raw body is stashed, since Fastify does not keep one.
 *
 * A `WeakMap` keyed on the request rather than a `fastify.decorateRequest`:
 * decorating adds the property to **every** request in the application, and
 * this plugin is the only thing that needs it. The map entry dies with the
 * request object, so there is nothing to clean up.
 */
const rawBodies = new WeakMap<object, string>();

const workflowWebhookRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * Keep the bytes as they arrived.
   *
   * Registered **inside this plugin**, so Fastify's encapsulation confines it to
   * these routes — every other JSON endpoint in the API keeps the default
   * parser and pays nothing for this.
   *
   * Kept because a byte-exact body is the only thing a body-bound check can be
   * computed over: `JSON.stringify` of the parsed object is not byte-identical
   * to what was sent — key order, spacing and number formatting all move — so
   * anything checked against a re-serialised body fails for essentially every
   * sender that is not Node. Nothing verifies against it today; see
   * `webhooks/receive.ts` for why there is no inbound signature mode.
   */
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string", bodyLimit: WEBHOOK_BODY_LIMIT },
    (request, body, done) => {
      const text = typeof body === "string" ? body : body.toString("utf8");
      rawBodies.set(request, text);
      // An empty body is legitimate — a ping with no payload — and `JSON.parse("")`
      // throws, which would 400 a delivery that is perfectly well-formed HTTP.
      if (!text.trim()) return done(null, {});
      try {
        done(null, JSON.parse(text));
      } catch {
        // Deliberately not the shared 404: a malformed body is the sender's own
        // bug, they are already authenticated by the time this matters, and
        // telling them "not found" would send them hunting for the wrong thing.
        done(Object.assign(new Error("Body is not valid JSON"), { statusCode: 400 }));
      }
    },
  );

  fastify.post(
    "/:token",
    {
      schema: { params: webhookParams },
      config: { rateLimit: WEBHOOK_LIMIT },
      bodyLimit: WEBHOOK_BODY_LIMIT,
    },
    async (request, reply) => {
      const db = getDb();

      const result = await resolveWebhook(db, {
        pathToken: request.params.token,
        headers: request.headers as Record<string, unknown>,
        // Kept by the content-type parser above, because Fastify does not
        // retain one and re-serialising loses byte-exactness.
        rawBody: rawBodies.get(request) ?? "",
      });

      if (!result.ok) {
        // Logged with the real reason; the caller gets one word.
        request.log.info(
          { reason: result.reason, token: request.params.token.slice(0, 8) },
          "webhook refused",
        );
        return reply.status(result.status).send({ message: result.message });
      }

      const { webhook } = result;

      // Best-effort and deliberately not awaited into the failure path: a
      // counter that could not be written must not turn a good delivery into a
      // 500 the sender will retry.
      void recordReceipt(db, webhook.webhookId).catch((err) => {
        request.log.warn({ err, webhookId: webhook.webhookId }, "receipt not recorded");
      });

      const payload = buildWebhookPayload({
        headers: request.headers as Record<string, unknown>,
        body: request.body,
        query: request.query as Record<string, unknown>,
      });

      const run = await execute({
        tenantId: webhook.tenantId,
        workflowId: webhook.workflowId,
        // A webhook is about nothing in particular. A trigger that wants a
        // record maps one out of the body itself, which is a node's job — the
        // receiver must not guess a subject from an untrusted payload.
        subject: null,
        event: { type: "webhook.received", payload },
        source: "webhook",
        actorUserId: null,
      });

      // 202, not 200. The automation has been accepted, not finished — it may
      // contain a three-day Wait, and a sender holding a connection open for
      // that would time out and retry, sending it twice.
      return reply.status(202).send({
        data: { executionId: run.executionId, status: run.status },
      });
    },
  );
};

export default workflowWebhookRoutes;
