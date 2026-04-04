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
) {
  try {
    const res = await fetch(`${API_URL}/availability`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ schedule }),
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
      { cache: "no-store" },
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
      `${API_URL}/public/booking/${slug}/availability?month=${month}`,
      { cache: "no-store" },
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
      `${API_URL}/public/booking/${slug}/slots?date=${date}`,
      { cache: "no-store" },
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
  },
) {
  try {
    const res = await fetch(`${API_URL}/public/booking/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
