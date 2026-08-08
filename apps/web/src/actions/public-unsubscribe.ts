"use server";

import { API_URL } from "@/lib/api-url";

/**
 * The unsubscribe surface, unauthenticated.
 *
 * Raw `fetch` rather than `lib/api-fetch.ts` for the same reason
 * `public-quote.ts` uses it: `api-fetch` forwards the caller's cookies, and a
 * recipient clicking a link from their inbox has no session to forward — while
 * a *tenant user* who happens to click one would be forwarding theirs to an
 * endpoint that must not care who is logged in.
 *
 * `notFound` is carried separately from `error` throughout. Collapsing them is
 * QUO-07 — an outage told a customer their estimate did not exist — and it
 * would be worse here: "this link is invalid" to someone trying to stop email
 * they did not ask for is the single most annoying way to fail.
 */

export interface UnsubscribeTarget {
  businessName: string;
  /** Masked — `d•••@example.com`. Enough to recognise, not to harvest. */
  email: string | null;
  alreadyOptedOut: boolean;
}

export async function getUnsubscribeTarget(token: string): Promise<{
  data: UnsubscribeTarget | null;
  notFound: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(
      `${API_URL}/public/unsubscribe/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      return {
        data: null,
        notFound: res.status === 404,
        error:
          res.status === 404
            ? null
            : "We couldn't load this page right now. Please try again in a moment.",
      };
    }

    const json = await res.json();
    return { data: json.data as UnsubscribeTarget, notFound: false, error: null };
  } catch {
    return {
      data: null,
      notFound: false,
      error: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}

export async function confirmUnsubscribe(token: string): Promise<{
  ok: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(
      `${API_URL}/public/unsubscribe/${encodeURIComponent(token)}`,
      { method: "POST", cache: "no-store" },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: body.message ?? "We couldn't complete that. Please try again.",
      };
    }

    return { ok: true, error: null };
  } catch {
    return {
      ok: false,
      error: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}
