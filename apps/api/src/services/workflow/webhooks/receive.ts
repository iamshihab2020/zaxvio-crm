/**
 * Resolving and authorising an inbound webhook.
 *
 * Split from the route so the security decisions can be tested without binding
 * a port — the same reason `lib/error-handler.ts` was extracted, and for the
 * same underlying cause: `server.ts` calls `start()` at module scope, so a
 * module that cannot be imported without side effects cannot be tested.
 *
 * ## Every refusal returns the same thing
 *
 * An unknown token, a switched-off endpoint, a workflow that has been archived,
 * a wrong secret and a tenant that no longer exists all produce
 * `{ ok: false, status: 404 }` with one message. That is
 * [[wf-10-security|§10.4]]'s enumeration control, and it is why the *reason*
 * lives in a separate field the route logs and never sends: an attacker probing
 * tokens must not be able to tell "that endpoint exists but your secret is
 * wrong" from "no such endpoint".
 *
 * The single exception is the rate limiter, which is upstream of this and
 * answers 429 — that is a signal about the caller, not about the resource.
 *
 * ## There is no inbound signature mode, and that is a decision
 *
 * An `hmac` mode shipped here first and **could never have validated a single
 * request**. Verifying an HMAC requires the verifier to hold the key; inbound
 * secrets are stored as a sha256 hash on purpose, so the sender would have
 * signed with the secret and this would have checked against its hash. Two
 * different keys. Worse, every refusal here returns the same 404, so the mode
 * would have failed silently and permanently — indistinguishable from a wrong
 * secret, on an endpoint whose owner had done nothing wrong.
 *
 * The two ways out are storing the secret reversibly (a key-management surface
 * this product does not have) or not offering the mode. Not offering it is the
 * honest one: a bearer secret compared in constant time against a stored hash is
 * a real control, and a signature mode that cannot succeed is not.
 *
 * If it is ever wanted, it needs encrypted-at-rest secret storage first — and
 * `signBody` in `secrets.ts` is the primitive, already correct, used today by
 * the **outbound** node where we do hold the key.
 */

import {
  workflowWebhooks,
  workflows,
  eq,
  sql,
  type getDb,
} from "@hvac-saas/database";
import { safeHeaders, secretMatches } from "./secrets.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface ResolvedWebhook {
  webhookId: string;
  tenantId: string;
  workflowId: string;
  workflowName: string;
}

export type ReceiveResult =
  | { ok: true; webhook: ResolvedWebhook }
  | {
      ok: false;
      /** Always 404. Named so nothing accidentally starts differentiating. */
      status: 404;
      /** What the caller is told — identical for every refusal. */
      message: string;
      /** What we log. Never sent. */
      reason:
        | "unknown_token"
        | "webhook_inactive"
        | "workflow_inactive"
        | "workflow_archived"
        | "missing_secret"
        | "bad_secret";
    };

/** One message for every refusal. */
const REFUSAL = "Not found";

function refuse(reason: Extract<ReceiveResult, { ok: false }>["reason"]): ReceiveResult {
  return { ok: false, status: 404, message: REFUSAL, reason };
}

export interface ReceiveArgs {
  pathToken: string;
  headers: Record<string, unknown>;
  /**
   * The raw body as it arrived.
   *
   * Unused by the checks below today — the only inbound mode is a bearer
   * secret. Kept on the shape because the receiver is where a body-bound check
   * would go if secrets ever become retrievable, and because re-plumbing a raw
   * body through a content-type parser after the fact is exactly the kind of
   * change nobody makes.
   */
  rawBody: string;
}

/**
 * Resolve a path token to a workflow, and check whatever authorisation the
 * endpoint declares.
 *
 * Does **not** dispatch. Firing the automation is the caller's job, so this
 * function stays free of the engine and can be exercised against a real
 * database without one.
 */
export async function resolveWebhook(
  db: Db,
  args: ReceiveArgs,
): Promise<ReceiveResult> {
  const [row] = await db
    .select({
      webhookId: workflowWebhooks.id,
      tenantId: workflowWebhooks.tenantId,
      workflowId: workflowWebhooks.workflowId,
      authMode: workflowWebhooks.authMode,
      secretHash: workflowWebhooks.secretHash,
      isActive: workflowWebhooks.isActive,
      workflowName: workflows.name,
      workflowActive: workflows.isActive,
      workflowArchivedAt: workflows.archivedAt,
    })
    .from(workflowWebhooks)
    // An inner join, so a webhook whose workflow was hard-deleted resolves to
    // nothing rather than to a row with a null workflow that later code has to
    // remember to check.
    .innerJoin(workflows, eq(workflows.id, workflowWebhooks.workflowId))
    .where(eq(workflowWebhooks.pathToken, args.pathToken));

  if (!row) return refuse("unknown_token");
  if (!row.isActive) return refuse("webhook_inactive");
  if (row.workflowArchivedAt) return refuse("workflow_archived");
  // A switched-off automation refuses its webhook too. The switch means "this
  // does not run", and an endpoint that kept firing a paused automation would
  // make the switch mean something different depending on how it was reached.
  if (!row.workflowActive) return refuse("workflow_inactive");

  if (row.authMode !== "none") {
    if (!row.secretHash) {
      // Declares authentication and has no secret stored. Corrupt config rather
      // than a wrong caller, and the safe reading is to refuse.
      return refuse("missing_secret");
    }

    const presented = readAuthHeader(args.headers);
    if (!presented) return refuse("bad_secret");
    if (!secretMatches(presented, row.secretHash)) return refuse("bad_secret");
  }

  return {
    ok: true,
    webhook: {
      webhookId: row.webhookId,
      tenantId: row.tenantId,
      workflowId: row.workflowId,
      workflowName: row.workflowName,
    },
  };
}

/**
 * Where the caller is expected to put it.
 *
 * `x-webhook-secret` rather than `Authorization`, because `Authorization` is
 * stripped by the header allowlist before an automation can read it — and a
 * sender told to use a header the system then refuses to surface would have no
 * way to debug their own integration.
 */
function readAuthHeader(headers: Record<string, unknown>): string | null {
  const name = "x-webhook-secret";
  const value = headers[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return String(value[0]).trim();
  return null;
}

/** Record the arrival. Best-effort — a counter must never fail a delivery. */
export async function recordReceipt(db: Db, webhookId: string): Promise<void> {
  await db
    .update(workflowWebhooks)
    .set({
      lastReceivedAt: new Date(),
      // `sql` rather than a read-then-write: two deliveries in the same second
      // would otherwise both read N and both write N+1.
      receivedCount: sql`${workflowWebhooks.receivedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workflowWebhooks.id, webhookId));
}

/**
 * The payload an automation sees, built from what arrived.
 *
 * Headers go through the allowlist; the body is capped. Both bounds exist for
 * the same reason: this lands in `jsonb` on the execution row, is serialised
 * into every resumed run's context, and counts against `MAX_CONTEXT_BYTES`.
 */
export function buildWebhookPayload(args: {
  headers: Record<string, unknown>;
  body: unknown;
  query: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    headers: safeHeaders(args.headers),
    body: capped(args.body),
    query: capped(args.query),
    receivedAt: new Date().toISOString(),
  };
}

/** 64 KB of JSON, measured after serialising rather than guessed from shape. */
const MAX_PAYLOAD_BYTES = 64 * 1024;

function capped(value: unknown): unknown {
  const json = JSON.stringify(value ?? null);
  if (json.length <= MAX_PAYLOAD_BYTES) return value;
  // Replaced rather than truncated. A truncated JSON string is not JSON, and
  // half an object read by `{{webhook.body.x}}` would resolve to nothing with
  // no indication that anything had been dropped.
  return {
    __truncated: true,
    __originalBytes: json.length,
    __note:
      "This payload was larger than 64KB and was not stored. Send less, or store it on your side and send an id.",
  };
}
