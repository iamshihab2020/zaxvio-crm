/**
 * `http.request` — call another system's API.
 *
 * Everything dangerous about this node lives in `services/workflow/http/`. This
 * file's job is the three things that are *this run's* business: the quota, the
 * test-run rule for the response body, and turning a refusal into a sentence.
 *
 * ## The body is only readable on a test run
 *
 * [[wf-10-security|§10.5]], and the item its own text calls one of the two most
 * commonly missed. A response body written into `node_execution_logs` is
 * whatever the remote server chose to send, stored for 90 days, readable by
 * anyone with run-history access. A tenant pointing this at their own admin API
 * would be exfiltrating it into our logs without meaning to.
 *
 * So the status and headers always flow to later steps, and the body only when
 * `ctx.isTest`. The step's own test button is where you look at a response;
 * a live run is where you act on a status code.
 */

import { TENANT_QUOTAS } from "@hvac-saas/workflow-nodes";
import { fetchOutbound } from "../../http/outbound.js";
import { NodeFailure } from "../errors.js";
import { outboundUsedToday } from "../outbound-quota.js";
import type { Executor } from "./types.js";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const httpRequestExecutor: Executor = async ({ db, ctx, params, node }) => {
  const url = typeof params.url === "string" ? params.url.trim() : "";
  if (!url) {
    throw new NodeFailure(
      `http.request has no URL on ${node.id}`,
      `"${node.label}" has no address to call. If you used a variable there, it may have come out blank.`,
    );
  }

  const method = typeof params.method === "string" ? params.method.toUpperCase() : "POST";
  if (!METHODS.has(method)) {
    throw new NodeFailure(
      `http.request bad method on ${node.id}`,
      `"${node.label}" has no valid method chosen. Open the step and pick one.`,
    );
  }

  const used = await outboundUsedToday(db, ctx.tenantId);
  if (used >= TENANT_QUOTAS.MAX_DAILY_OUTBOUND_REQUESTS) {
    // Skipped rather than failed. Hitting a daily ceiling is the ceiling
    // working, and a failure notification for it would arrive alongside four
    // hundred others. The run log says the number and the reason.
    return {
      skipped: `This workspace has already made ${TENANT_QUOTAS.MAX_DAILY_OUTBOUND_REQUESTS} outside calls today, which is the daily limit. This step will run again tomorrow.`,
    };
  }

  const result = await fetchOutbound({
    url,
    method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    headers: headersFrom(params.headers),
    body: typeof params.body === "string" && params.body ? params.body : undefined,
  });

  if (!result.ok) {
    // A refused **address** is a config problem the author must fix — they typed
    // an internal address, or the host does not exist. A timeout or a network
    // error is the day being what it is, and failing the run for it would email
    // the tenant every time somebody else's API had a bad minute.
    const isConfig =
      result.reason !== "connect_timeout" &&
      result.reason !== "read_timeout" &&
      result.reason !== "network_error";

    if (isConfig) {
      throw new NodeFailure(
        `http.request refused on ${node.id}: ${result.reason}`,
        `"${node.label}" could not call that address. ${result.message}`,
      );
    }
    return { skipped: `${result.message} Nothing was sent.` };
  }

  return {
    output: {
      status: result.status,
      ok: result.status >= 200 && result.status < 300,
      headers: result.headers,
      redirects: result.redirects,
      // The rule this node exists to keep. On a live run later steps see the
      // status and nothing of what came back.
      ...(ctx.isTest
        ? { body: result.body, truncated: result.truncated }
        : { bodyWithheld: true }),
    },
  };
};

/** `keyValue` persists as `{key, value}` rows, which is what keeps the order. */
function headersFrom(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const entry = row as { key?: unknown; value?: unknown };
    if (typeof entry.key !== "string" || !entry.key.trim()) continue;
    out[entry.key.trim()] = typeof entry.value === "string" ? entry.value : "";
  }
  return out;
}

export default httpRequestExecutor;
