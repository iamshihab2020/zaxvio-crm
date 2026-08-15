/**
 * The one place this system makes an outbound HTTP request. P10.
 *
 * Built on `node:https`/`node:http` rather than `fetch`, for one reason that
 * decides it: **`request()` accepts a custom `lookup`, and `fetch` does not.**
 *
 * That matters because pinning the connection to a pre-validated address is the
 * whole guard. Handing a hostname to `fetch` after validating that hostname is
 * not a check — an attacker controls their own DNS and can answer the
 * validator's lookup with a public address and the connection's lookup,
 * milliseconds later, with `169.254.169.254`. Both answers are legitimately
 * theirs to give.
 *
 * Rewriting the URL to the IP and setting a `Host` header would also pin it, and
 * would break TLS: the certificate is checked against the URL's hostname, so an
 * IP in the URL means either a failed handshake or a disabled check. A custom
 * `lookup` keeps SNI and certificate validation intact while still connecting
 * only where we said.
 *
 * ## Every control in §10.5, and where it is
 *
 * | Control | Here |
 * |---|---|
 * | Scheme allowlist | `validateOutboundUrl` |
 * | Private / loopback / link-local denial | `validateOutboundUrl` |
 * | Resolve, validate, connect to the address | `pinnedLookup` below |
 * | Re-validate every redirect, cap at 3 | the `for` loop below |
 * | Response size cap | `MAX_RESPONSE_BYTES`, enforced while streaming |
 * | Connect / read timeouts | `CONNECT_TIMEOUT_MS` / `READ_TIMEOUT_MS` |
 * | Body not logged outside a test run | the caller's `includeBody` |
 * | Per-tenant quota | `assertOutboundQuota`, called by the executor |
 */

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import {
  CONNECT_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  READ_TIMEOUT_MS,
  validateOutboundUrl,
} from "./url-validator.js";

export interface OutboundRequest {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

export type OutboundResult =
  | {
      ok: true;
      status: number;
      headers: Record<string, string>;
      /** Capped, and flagged when it was. */
      body: string;
      truncated: boolean;
      redirects: number;
    }
  | { ok: false; reason: string; message: string };

/**
 * Headers we refuse to forward, whatever the author typed.
 *
 * `host` because it is derived from the URL and overriding it is how a request
 * gets routed somewhere the validator did not see. The rest because they are
 * ours to set and a node that could set them could impersonate this server to
 * whatever it is calling.
 */
const FORBIDDEN_REQUEST_HEADERS: ReadonlySet<string> = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "upgrade",
  "x-internal-proxy-secret",
]);

export async function fetchOutbound(
  args: OutboundRequest,
): Promise<OutboundResult> {
  let target = args.url;
  let redirects = 0;

  // A loop rather than recursion, so the redirect count is impossible to lose.
  // Each hop is validated from scratch — a 302 to `http://169.254.169.254/`
  // defeats any guard that only ever looked at the first URL.
  for (;;) {
    const check = await validateOutboundUrl(target);
    if (!check.ok) {
      return { ok: false, reason: check.reason, message: check.message };
    }

    const response = await once(check.url, check.addresses, args, redirects > 0);

    if (!response.ok) return response;

    if (isRedirect(response.status) && response.location) {
      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        return {
          ok: false,
          reason: "too_many_redirects",
          message: `That address redirected more than ${MAX_REDIRECTS} times.`,
        };
      }
      // Resolved against the current URL, so a relative `Location` works — and
      // then validated on the next pass like any other address.
      target = new URL(response.location, check.url).toString();
      continue;
    }

    return {
      ok: true,
      status: response.status,
      headers: response.headers,
      body: response.body,
      truncated: response.truncated,
      redirects,
    };
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

interface OnceResult {
  ok: true;
  status: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  location: string | null;
}

/**
 * One hop.
 *
 * `afterRedirect` drops the body and forces GET on a 303 the way a browser
 * would — a POST body replayed to a redirect target is a request the author
 * never wrote to an address they never named.
 */
function once(
  url: URL,
  addresses: string[],
  args: OutboundRequest,
  afterRedirect: boolean,
): Promise<OnceResult | Extract<OutboundResult, { ok: false }>> {
  return new Promise((resolve) => {
    const isHttps = url.protocol === "https:";
    const send = isHttps ? httpsRequest : httpRequest;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(args.headers ?? {})) {
      if (FORBIDDEN_REQUEST_HEADERS.has(key.toLowerCase())) continue;
      headers[key] = value;
    }
    headers["accept-encoding"] = "identity"; // so the size cap counts real bytes

    const body = afterRedirect ? undefined : args.body;
    if (body) headers["content-length"] = String(Buffer.byteLength(body));

    let settled = false;
    const finish = (result: OnceResult | Extract<OutboundResult, { ok: false }>) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = send(
      {
        protocol: url.protocol,
        // The **hostname**, so SNI and certificate validation still work…
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: afterRedirect ? "GET" : args.method,
        headers,
        // …while the connection goes only where the validator already looked.
        // This is the line that closes DNS rebinding.
        lookup: pinnedLookup(addresses),
        timeout: CONNECT_TIMEOUT_MS,
      },
      (res) => {
        let received = 0;
        let truncated = false;
        const chunks: Buffer[] = [];

        // The read timeout is separate from the connect timeout: a server that
        // accepts a connection and then trickles one byte a minute would sit
        // under a connect timeout forever.
        const readTimer = setTimeout(() => {
          req.destroy();
          finish({
            ok: false,
            reason: "read_timeout",
            message: "That address took too long to answer.",
          });
        }, READ_TIMEOUT_MS);

        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) {
            // Stop reading rather than buffering the rest and trimming. The cap
            // exists to bound memory, and a cap applied after the allocation
            // bounds nothing.
            truncated = true;
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          clearTimeout(readTimer);
          finish({
            ok: true,
            status: res.statusCode ?? 0,
            headers: flattenHeaders(res.headers),
            body: Buffer.concat(chunks).toString("utf8"),
            truncated,
            location: typeof res.headers.location === "string" ? res.headers.location : null,
          });
        });

        res.on("close", () => {
          clearTimeout(readTimer);
          if (truncated) {
            finish({
              ok: true,
              status: res.statusCode ?? 0,
              headers: flattenHeaders(res.headers),
              body: Buffer.concat(chunks).toString("utf8"),
              truncated: true,
              location: null,
            });
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      finish({
        ok: false,
        reason: "connect_timeout",
        message: "That address did not answer in time.",
      });
    });

    req.on("error", (err) => {
      finish({
        ok: false,
        reason: "network_error",
        // The underlying message is not surfaced: it can contain the resolved
        // address, which is information about our own network.
        message: `Could not reach that address.${err.name === "AbortError" ? "" : ""}`,
      });
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * A `lookup` that answers only with addresses the validator already approved.
 *
 * Node calls this instead of the system resolver, so there is no second DNS
 * query and therefore no window in which the answer can change.
 */
function pinnedLookup(addresses: string[]): LookupFunction {
  return ((hostname, options, callback) => {
    const cb = typeof options === "function" ? options : callback;
    const all =
      typeof options === "object" && options !== null && "all" in options
        ? Boolean(options.all)
        : false;

    const mapped = addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }));

    if (all) {
      (cb as (err: null, addresses: typeof mapped) => void)(null, mapped);
      return;
    }
    (cb as (err: null, address: string, family: number) => void)(
      null,
      mapped[0].address,
      mapped[0].family,
    );
  }) as LookupFunction;
}

function flattenHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
}
