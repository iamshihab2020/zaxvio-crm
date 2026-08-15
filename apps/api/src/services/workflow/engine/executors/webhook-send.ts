/**
 * `webhook.send` — tell another system something happened here.
 *
 * Same guard as `http.request`, same quota, same refusal vocabulary. The
 * difference is the body: a **fixed envelope** built from the run, not JSON the
 * author typed.
 *
 * That is the whole reason this node is separate. A free-form body is where
 * somebody accidentally posts a customer's full record to a third party, and a
 * fixed shape is something the receiving end can be written against once and
 * keep working. The escape hatch is `extra`, which is additive and visible.
 *
 * ## The signature is over the body we send
 *
 * `HMAC-SHA256(secret, body)`, hex, in an `X-Zaxvio-Signature` header.
 *
 * It shipped first as `sha256(secret + "." + body)` — a **secret-prefix MAC**,
 * which SHA-256's Merkle-Damgard construction makes forgeable by length
 * extension: one captured signed message is enough to sign an extended one
 * without ever learning the secret, and the receiving system would accept it as
 * ours. The delimiter does not help; it is just more bytes in the prefix.
 *
 * The receiver has no matching mode, deliberately — see `webhooks/receive.ts`
 * for why verifying an HMAC against a stored *hash* cannot work.
 */

import { TENANT_QUOTAS } from "@hvac-saas/workflow-nodes";
import { fetchOutbound } from "../../http/outbound.js";
import { signBody } from "../../webhooks/secrets.js";
import { NodeFailure } from "../errors.js";
import { outboundUsedToday } from "../outbound-quota.js";
import type { Executor } from "./types.js";

const webhookSend: Executor = async ({ db, ctx, params, node }) => {
  const url = typeof params.url === "string" ? params.url.trim() : "";
  if (!url) {
    throw new NodeFailure(
      `webhook.send has no URL on ${node.id}`,
      `"${node.label}" has no address to send to. If you used a variable there, it may have come out blank.`,
    );
  }

  const used = await outboundUsedToday(db, ctx.tenantId);
  if (used >= TENANT_QUOTAS.MAX_DAILY_OUTBOUND_REQUESTS) {
    return {
      skipped: `This workspace has already made ${TENANT_QUOTAS.MAX_DAILY_OUTBOUND_REQUESTS} outside calls today, which is the daily limit. This step will run again tomorrow.`,
    };
  }

  const payload = {
    event: ctx.trigger.event,
    automation: { id: ctx.workflowId, name: ctx.workflowName },
    // The execution id, so the receiving system can be told which run this was
    // and the tenant can find it in their own history when something disagrees.
    executionId: ctx.executionId,
    subject: ctx.subject,
    customer: ctx.customer
      ? {
          id: ctx.customer.id,
          name: ctx.customer.fullName,
          email: ctx.customer.email,
          phone: ctx.customer.phone,
        }
      : null,
    job: ctx.job ? { id: ctx.job.id, number: ctx.job.number, status: ctx.job.status } : null,
    invoice: ctx.invoice
      ? { id: ctx.invoice.id, number: ctx.invoice.number, status: ctx.invoice.status }
      : null,
    ...extraFrom(params.extra),
    sentAt: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };

  const secret = typeof params.secret === "string" ? params.secret.trim() : "";
  if (secret) {
    // Real HMAC, not `sha256(secret + body)`. That construction is a
    // secret-prefix MAC, and SHA-256 is Merkle-Damgard: its digest is its
    // internal state, so anyone holding one signed message can resume from it,
    // append bytes, and forge a signature for the extended body without the
    // secret. The receiving system would accept it as ours.
    headers["x-zaxvio-signature"] = `sha256=${signBody(body, secret)}`;
  }

  const result = await fetchOutbound({ url, method: "POST", headers, body });

  if (!result.ok) {
    const isConfig =
      result.reason !== "connect_timeout" &&
      result.reason !== "read_timeout" &&
      result.reason !== "network_error";

    if (isConfig) {
      throw new NodeFailure(
        `webhook.send refused on ${node.id}: ${result.reason}`,
        `"${node.label}" could not send to that address. ${result.message}`,
      );
    }
    return { skipped: `${result.message} Nothing was sent.` };
  }

  // No body, ever — not even on a test run. Unlike `http.request`, nobody sends
  // this expecting to *read* a reply, so there is no case where storing one is
  // worth the exposure.
  return {
    output: {
      status: result.status,
      ok: result.status >= 200 && result.status < 300,
      redirects: result.redirects,
    },
  };
};

function extraFrom(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const entry = row as { key?: unknown; value?: unknown };
    if (typeof entry.key !== "string" || !entry.key.trim()) continue;
    // Reserved names are skipped rather than overwriting the envelope. An
    // `extra` field called `customer` replacing the real one is a message the
    // receiving system cannot trust.
    const key = entry.key.trim();
    if (RESERVED.has(key)) continue;
    out[key] = typeof entry.value === "string" ? entry.value : String(entry.value ?? "");
  }
  return out;
}

const RESERVED: ReadonlySet<string> = new Set([
  "event",
  "automation",
  "executionId",
  "subject",
  "customer",
  "job",
  "invoice",
  "sentAt",
]);

export default webhookSend;
