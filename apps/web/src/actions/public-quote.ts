"use server";

import { API_URL } from "@/lib/api-url";

/**
 * `notFound` distinguishes "this token is not a quote" from "we could not
 * reach the API" (QUO-07). The page used to call `notFound()` on both, so an
 * outage told the customer their estimate did not exist.
 */
export async function getPublicQuote(token: string) {
  try {
    const res = await fetch(`${API_URL}/public/quote/${token}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        notFound: res.status === 404,
        error: err.message ?? "We couldn't load this estimate right now.",
      };
    }

    const json = await res.json();
    return { data: json.data, notFound: false, error: null };
  } catch {
    return {
      data: null,
      notFound: false,
      error: "We couldn't reach the server. Please try again in a moment.",
    };
  }
}

export async function acceptPublicQuote(
  token: string,
  data?: { scheduledDate?: string; scheduledTime?: string },
) {
  try {
    const res = await fetch(`${API_URL}/public/quote/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data ?? {}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to accept quote" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function declinePublicQuote(
  token: string,
  data?: { reason?: string },
) {
  try {
    const res = await fetch(`${API_URL}/public/quote/${token}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data ?? {}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to decline quote" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
