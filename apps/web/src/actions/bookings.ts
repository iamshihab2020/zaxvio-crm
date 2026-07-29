"use server";

import { cookies, headers } from "next/headers";

import { API_URL } from "@/lib/api-url";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/**
 * Headers that let the API rate-limit the *visitor* rather than this server.
 *
 * The public booking endpoints are called from here, not from the browser, so
 * Fastify sees one IP for every customer and the whole application shares a
 * single 100/min bucket (BOOK-02). The shared secret is what makes the API
 * willing to believe the forwarded address; without it configured, these
 * headers are absent and the API falls back to its own view of the peer.
 */
async function getClientForwardHeaders(): Promise<Record<string, string>> {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  if (!secret) return {};

  const headerList = await headers();
  const clientIp =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "";
  if (!clientIp) return {};

  return {
    "x-internal-proxy-secret": secret,
    "x-client-ip": clientIp,
  };
}

// ===== BOOKING STATS =====

export async function getBookingStats() {
  try {
    const res = await fetch(`${API_URL}/bookings/stats`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });
    if (!res.ok) return { data: null, error: "Failed to load stats" };
    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ==================== TENANT BOOKING ACTIONS ====================

export async function getBookings(params?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  showArchived?: boolean;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
    if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);
    if (params?.showArchived) searchParams.set("showArchived", "true");

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/bookings${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, pagination: null, error: err.message ?? "Failed to fetch bookings" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, pagination: null, error: "Network error" };
  }
}

export async function getBooking(id: string) {
  try {
    const res = await fetch(`${API_URL}/bookings/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch booking" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getBookingActivities(
  id: string,
  params?: { page?: number; limit?: number },
) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();

    const res = await fetch(
      `${API_URL}/bookings/${id}/activities${qs ? `?${qs}` : ""}`,
      { headers: { cookie: await getCookieHeader() }, cache: "no-store" },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch activity" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateBooking(id: string, updates: Record<string, unknown>) {
  try {
    const res = await fetch(`${API_URL}/bookings/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(updates),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update booking" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function convertBookingToJob(id: string, pipelineStageId?: string) {
  try {
    const res = await fetch(`${API_URL}/bookings/${id}/convert-to-job`, {
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
      return { data: null, error: err.message ?? "Failed to convert booking" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function cancelBooking(id: string) {
  try {
    const res = await fetch(`${API_URL}/bookings/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to cancel booking" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ==================== AVAILABILITY ACTIONS ====================

export async function getAvailability() {
  try {
    const res = await fetch(`${API_URL}/availability`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch availability" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateAvailability(
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>,
  slotCapacity?: number,
) {
  try {
    const res = await fetch(`${API_URL}/availability`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(
        slotCapacity === undefined ? { schedule } : { schedule, slotCapacity },
      ),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update availability" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createScheduleOverride(data: {
  overrideDate: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/availability/overrides`, {
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
      return { data: null, error: err.message ?? "Failed to create override" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteScheduleOverride(id: string) {
  try {
    const res = await fetch(`${API_URL}/availability/overrides/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete override" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ==================== PUBLIC BOOKING ACTIONS (NO AUTH) ====================

export async function getPublicBookingPage(slug: string) {
  try {
    const res = await fetch(`${API_URL}/public/booking/${slug}`, {
      headers: await getClientForwardHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Business not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getPublicBookingStatus(slug: string, bookingId: string) {
  try {
    const res = await fetch(
      `${API_URL}/public/booking/${slug}/status/${bookingId}`,
      { headers: await getClientForwardHeaders(), cache: "no-store" },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Booking not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getPublicAvailability(slug: string, month: string) {
  try {
    const res = await fetch(
      `${API_URL}/public/booking/${slug}/availability?month=${encodeURIComponent(month)}`,
      { headers: await getClientForwardHeaders(), cache: "no-store" },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch availability" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getPublicSlots(slug: string, date: string) {
  try {
    const res = await fetch(
      `${API_URL}/public/booking/${slug}/slots?date=${encodeURIComponent(date)}`,
      { headers: await getClientForwardHeaders(), cache: "no-store" },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch time slots" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function submitPublicBooking(
  slug: string,
  data: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    serviceType: string;
    bookingDate: string;
    preferredTime: string;
    address?: string;
    description?: string;
    source?: "portal" | "embed" | "widget";
    quoteId?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/public/booking/${slug}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getClientForwardHeaders()),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to submit booking" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== BULK OPERATIONS =====

export async function bulkArchiveBookings(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/bookings/bulk-archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkRestoreBookings(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/bookings/bulk-restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkDeleteBookings(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/bookings/bulk-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkUpdateBookingStatus(ids: string[], status: string) {
  try {
    const res = await fetch(`${API_URL}/bookings/bulk-status-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids, status }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}
