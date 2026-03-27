"use server";

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

// ===== QUOTES CRUD =====

export async function getQuotes(params?: {
  search?: string;
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/quotes${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch quotes" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getQuote(id: string) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Quote not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createQuote(data: {
  customerId: string;
  issuedDate?: string;
  expiryDate?: string;
  taxRate?: string;
  discountAmount?: string;
  notes?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/quotes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to create quote" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateQuote(
  id: string,
  data: {
    notes?: string;
    expiryDate?: string;
    taxRate?: string;
    discountAmount?: string;
    customerId?: string;
    issuedDate?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update quote" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteQuote(id: string) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete quote" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function sendQuote(id: string) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to send quote" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getQuotePdfUrl(id: string) {
  return `${API_URL}/quotes/${id}/pdf`;
}

// ===== LINE ITEMS =====

export async function addQuoteLineItem(
  quoteId: string,
  data: {
    description?: string;
    unitPrice?: string;
    itemType?: string;
    quantity?: string;
    sortOrder?: number;
    catalogItemId?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/quotes/${quoteId}/line-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to add line item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateQuoteLineItem(
  quoteId: string,
  lineItemId: string,
  data: {
    description?: string;
    quantity?: string;
    unitPrice?: string;
    sortOrder?: number;
    itemType?: string;
    catalogItemId?: string | null;
  },
) {
  try {
    const res = await fetch(
      `${API_URL}/quotes/${quoteId}/line-items/${lineItemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: await getCookieHeader(),
        },
        body: JSON.stringify(data),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to update line item",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteQuoteLineItem(
  quoteId: string,
  lineItemId: string,
) {
  try {
    const res = await fetch(
      `${API_URL}/quotes/${quoteId}/line-items/${lineItemId}`,
      {
        method: "DELETE",
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to remove line item" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== ACCEPT / DECLINE / CONVERT =====

export async function acceptQuote(id: string) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
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

export async function declineQuote(id: string) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}/decline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
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

export async function convertQuoteToJob(id: string, pipelineStageId?: string) {
  try {
    const res = await fetch(`${API_URL}/quotes/${id}/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(pipelineStageId ? { pipelineStageId } : {}),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to convert quote to job",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== ACTIVITIES =====

export async function getQuoteActivities(
  quoteId: string,
  params?: { page?: number; limit?: number },
) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/quotes/${quoteId}/activities${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch activities" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
