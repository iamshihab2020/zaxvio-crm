"use server";

import { cookies } from "next/headers";

import { API_URL } from "@/lib/api-url";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export interface CalendarEventData {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  color: string;
  customerId: string | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getCalendarEvents(params?: {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
    if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/calendar-events${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch events" };
    }

    const json = await res.json();
    return { data: json.data as CalendarEventData[], pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createCalendarEvent(data: {
  title: string;
  eventDate: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  color?: string;
  customerId?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/calendar-events`, {
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
      return { data: null, error: err.message ?? "Failed to create event" };
    }

    const json = await res.json();
    return { data: json.data as CalendarEventData, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateCalendarEvent(
  id: string,
  data: {
    title?: string;
    eventDate?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    contactName?: string;
    contactPhone?: string;
    address?: string;
    notes?: string;
    color?: string;
    customerId?: string | null;
  },
) {
  try {
    const res = await fetch(`${API_URL}/calendar-events/${id}`, {
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
      return { data: null, error: err.message ?? "Failed to update event" };
    }

    const json = await res.json();
    return { data: json.data as CalendarEventData, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteCalendarEvent(id: string) {
  try {
    const res = await fetch(`${API_URL}/calendar-events/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete event" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}
