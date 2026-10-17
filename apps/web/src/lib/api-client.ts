/**
 * The browser's read path to the API.
 *
 * TanStack Query reads used to be server actions, and Next 14.2 runs server
 * actions strictly one at a time (`next/dist/shared/lib/router/action-queue.js`:
 * each waits for the previous to finish). A page's reads therefore took the SUM
 * of their latencies: the calendar's five reads, ~2s each from a dev machine,
 * filled in over ~10s, and the jobs board fired twelve in a row (2026-10-16).
 *
 * A plain `fetch` through the `/api/v1` rewrite (next.config.mjs) runs
 * concurrently, sends the session cookie first-party, and lets the API's
 * refreshed session-cache cookie reach the browser, which a server action
 * never could, so the cache was never renewed.
 *
 * Reads only. Mutations stay server actions: one at a time is right for writes.
 * The read modules in `lib/client-reads/` mirror their server actions line for
 * line, including the `any` that `res.json()` yields, so swapping an import
 * changes nothing downstream.
 */

import type { ApiResult } from "@/lib/api-fetch";

const BASE = "/api/v1";
const TIMEOUT_MS = 15_000;

/**
 * `?a=1&b=2` from exactly the keys the matching server action forwards, in the
 * same way: empty values are skipped and booleans travel only when true. A key
 * the action never sent must not start reaching the API now (`useBookings`
 * passes `schedule`, which `getBookings` has always dropped).
 */
export function pickQuery(
  params: Record<string, unknown> | undefined,
  keys: readonly string[],
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const key of keys) {
    const value = params[key];
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Byte-for-byte `buildQuery` from lib/api-fetch.ts, for reads whose server
 * action builds its URL with it. Unlike `pickQuery`, `false` travels as
 * "false". That module imports `next/headers`, so it cannot be imported here.
 */
export function buildQuery(
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * GET an API path. Never throws: a refusal carries the API's own `message`
 * (or `fallback`), and a timeout or dropped connection carries the same words
 * the server-action reads used.
 */
export async function readJson(path: string, fallback: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false as const,
        status: res.status,
        error: (err.message as string | undefined) ?? fallback,
      };
    }
    // An empty or non-JSON success body reads as `{}`, as it does in
    // lib/api-fetch.ts; it is not a network error.
    return { ok: true as const, status: res.status, json: await res.json().catch(() => ({})) };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false as const,
      status: 0,
      error: aborted ? "The server took too long to respond. Please try again." : "Network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mirrors of `apiGet` / `apiList` from lib/api-fetch.ts, for reads whose server
 * action uses those: the same `ApiResult` shape, the same "Something went
 * wrong" default and the same transport messages, so a caller that branches on
 * `status` or `notFound` behaves identically.
 */
async function readForResult(path: string, fallback: string) {
  const r = await readJson(path, fallback);
  if (r.ok || r.status !== 0) return r;
  return {
    ...r,
    error:
      r.error === "Network error" ? "Couldn't reach the server. Please try again." : r.error,
  };
}

export async function readResult<T>(
  path: string,
  fallback = "Something went wrong",
): Promise<ApiResult<T>> {
  const r = await readForResult(path, fallback);
  return {
    data: r.ok ? (r.json?.data ?? null) : null,
    error: r.ok ? null : r.error,
    status: r.status,
    notFound: r.status === 404,
  };
}

export async function readListResult<T>(
  path: string,
  fallback = "Something went wrong",
): Promise<ApiResult<T> & { pagination?: unknown }> {
  const r = await readForResult(path, fallback);
  return {
    data: r.ok ? (r.json?.data ?? null) : null,
    error: r.ok ? null : r.error,
    status: r.status,
    notFound: r.status === 404,
    pagination: r.ok ? r.json?.pagination : undefined,
  };
}
