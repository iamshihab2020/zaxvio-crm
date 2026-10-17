/**
 * Browser reads for bookings and availability: the TanStack Query side of
 * `@/actions/bookings`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/bookings";
import { pickQuery, readJson } from "@/lib/api-client";

const BOOKING_LIST_KEYS = [
  "status",
  "dateFrom",
  "dateTo",
  "search",
  "page",
  "limit",
  "sortBy",
  "sortOrder",
  "showArchived",
] as const;

export async function getBookings(params?: Parameters<typeof actions.getBookings>[0]) {
  const r = await readJson(
    `/bookings${pickQuery(params, BOOKING_LIST_KEYS)}`,
    "Failed to fetch bookings",
  );
  if (!r.ok) return { data: null, pagination: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

const BOOKING_ACTIVITY_KEYS = ["page", "limit"] as const;

export async function getBookingStats() {
  const r = await readJson("/bookings/stats", "Failed to load stats");
  // The action says this for any refusal and never shows the API's own message;
  // only a failed request (status 0) reads differently.
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to load stats" };
  return { data: r.json.data, error: null };
}

export async function getBooking(id: string) {
  const r = await readJson(`/bookings/${id}`, "Failed to fetch booking");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getBookingActivities(
  id: string,
  params?: Parameters<typeof actions.getBookingActivities>[1],
) {
  const r = await readJson(
    `/bookings/${id}/activities${pickQuery(params, BOOKING_ACTIVITY_KEYS)}`,
    "Failed to fetch activity",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getAvailability() {
  const r = await readJson("/availability", "Failed to fetch availability");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
