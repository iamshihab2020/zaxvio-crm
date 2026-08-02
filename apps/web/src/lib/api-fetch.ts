import { cookies } from "next/headers";
import { API_URL } from "@/lib/api-url";

/**
 * The one place the web app talks to the Fastify API.
 *
 * Before this file there were **216 hand-written `fetch` blocks** across 20
 * action files, each with its own try/catch, its own error string and its own
 * idea of a return shape — four were in circulation at once:
 *
 *   { data, error }                 425 returns
 *   { error }                        82
 *   { succeeded, failed, errors }    52
 *   raw res.json()                   26
 *
 * `getCookieHeader()` was copy-pasted into 19 of the 20 files and the literal
 * `"Network error"` appeared 208 times.
 *
 * That was not untidiness — it was the *generator* of the bugs the page audits
 * kept finding one at a time: CUST-03 (bulk toasts reporting success for
 * refused records), INV-11 and QUO-07 (404 and 500 collapsed into one branch),
 * QUO-29 (a server `message` silently defeating `bulkToast`). Every one of them
 * is the same root cause — 216 places to get error handling right. Auditing
 * pages finds instances; only a client fixes the class. (ARC-02)
 *
 * Design rules:
 *  - Return shapes are **unchanged**, so no caller had to be touched.
 *  - `status` is carried out of the transport, so callers can tell a 404 from a
 *    500 instead of collapsing both into "not found" (INV-11 / QUO-07).
 *  - Every request gets a timeout. A hung API used to hang the server action.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  /** HTTP status, or 0 when the request never completed. */
  status: number;
  /** True only for a genuine 404 — lets callers avoid the INV-11 collapse. */
  notFound: boolean;
}

export interface ApiVoidResult {
  error: string | null;
  status: number;
  notFound: boolean;
}

export interface BulkResult {
  succeeded: number;
  failed: number;
  errors: { id: string; message: string }[];
  error: string | null;
}

interface RequestOptions {
  /** Message used when the API returns no `message` of its own. */
  fallback?: string;
  /** Extra headers. `cookie` and `content-type` are handled here. */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** `?a=1&b=2` from a params object, skipping undefined/null/empty. */
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

async function request(
  path: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<{ ok: boolean; status: number; body: unknown; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
        cookie: await cookieHeader(),
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        (body as { message?: string })?.message ??
        options.fallback ??
        "Something went wrong";
      return { ok: false, status: res.status, body, error: message };
    }

    return { ok: true, status: res.status, body, error: null };
  } catch (err) {
    // An abort is a timeout, and saying so is more useful than "network error".
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      body: null,
      error: aborted
        ? "The server took too long to respond. Please try again."
        : "Couldn't reach the server. Please try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function toResult<T>(r: Awaited<ReturnType<typeof request>>): ApiResult<T> {
  return {
    data: r.ok ? ((r.body as { data?: T })?.data ?? null) : null,
    error: r.error,
    status: r.status,
    notFound: r.status === 404,
  };
}

export async function apiGet<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  return toResult<T>(await request(path, { method: "GET" }, options));
}

/**
 * A list response, which carries `pagination` alongside `data`. Kept separate
 * so the pagination field is typed rather than spread by hand at 30 call sites.
 */
export async function apiList<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T> & { pagination?: unknown }> {
  const r = await request(path, { method: "GET" }, options);
  return {
    ...toResult<T>(r),
    pagination: r.ok ? (r.body as { pagination?: unknown })?.pagination : undefined,
  };
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  return toResult<T>(
    await request(
      path,
      { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) },
      options,
    ),
  );
}

/** For endpoints whose success carries no payload — deletes, mostly. */
export async function apiVoid(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiVoidResult> {
  const r = await request(
    path,
    { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) },
    options,
  );
  return { error: r.error, status: r.status, notFound: r.status === 404 };
}

/**
 * Bulk endpoints. All 8 domains return `{succeeded, failed, errors}`; this
 * normalises the transport-failure case to the same shape so `bulkToast` never
 * has to guess (QUO-29 was a server-authored `message` defeating exactly that).
 */
export async function apiBulk(
  path: string,
  body: { ids: string[] } & Record<string, unknown>,
  options: RequestOptions = {},
): Promise<BulkResult> {
  const r = await request(path, { method: "POST", body: JSON.stringify(body) }, options);

  if (!r.ok) {
    return {
      succeeded: 0,
      failed: body.ids.length,
      errors: [],
      error: r.error,
    };
  }

  const payload = r.body as Partial<BulkResult>;
  return {
    succeeded: payload.succeeded ?? 0,
    failed: payload.failed ?? 0,
    errors: payload.errors ?? [],
    error: null,
  };
}

/**
 * Binary payloads (PDFs). Returns base64 because an ArrayBuffer does not
 * survive the server-action boundary.
 */
export async function apiBinary(
  path: string,
  options: RequestOptions & { filenameFallback: string },
): Promise<{ data: { base64: string; filename: string } | null; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { cookie: await cookieHeader() },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: (err as { message?: string }).message ?? options.fallback ?? "Failed to load file",
      };
    }

    const buffer = await res.arrayBuffer();
    return {
      data: {
        base64: Buffer.from(buffer).toString("base64"),
        filename:
          res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
          options.filenameFallback,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Couldn't reach the server. Please try again." };
  } finally {
    clearTimeout(timer);
  }
}
