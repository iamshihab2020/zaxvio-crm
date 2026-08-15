/**
 * `trigger.webhook`.
 *
 * The payload is on `ctx.trigger.payload`, not re-read from anywhere — a webhook
 * has no record behind it, so there is nothing to re-read. That also makes it
 * the one trigger whose data is genuinely frozen at the moment it fired: a
 * resumed run three days later still sees exactly what was sent, because there
 * is no row that could have changed underneath it.
 *
 * Nothing here is trusted. The headers were allowlisted and the body capped by
 * the receiver before they reached the queue; this only reshapes them so a step
 * below can address `{{previous.Webhook.body}}` as well as `{{trigger.body}}`.
 */

import type { Executor } from "./types.js";

const triggerWebhook: Executor = async ({ ctx }) => {
  const payload = ctx.trigger.payload ?? {};
  return {
    output: {
      body: payload.body ?? null,
      headers: payload.headers ?? {},
      query: payload.query ?? {},
      receivedAt: payload.receivedAt ?? null,
    },
  };
};

export default triggerWebhook;
