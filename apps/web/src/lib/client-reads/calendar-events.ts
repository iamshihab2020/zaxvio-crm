/**
 * Browser reads for calendar events: the TanStack Query side of
 * `@/actions/calendar-events`. Mirrors the server action exactly, including
 * its `CalendarEventData[]` typing; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/calendar-events";
import type { CalendarEventData } from "@/actions/calendar-events";
import { pickQuery, readJson } from "@/lib/api-client";

const CALENDAR_EVENT_KEYS = ["dateFrom", "dateTo", "page", "limit"] as const;

export async function getCalendarEvents(
  params?: Parameters<typeof actions.getCalendarEvents>[0],
) {
  const r = await readJson(
    `/calendar-events${pickQuery(params, CALENDAR_EVENT_KEYS)}`,
    "Failed to fetch events",
  );
  if (!r.ok) return { data: null, error: r.error };
  return {
    data: r.json.data as CalendarEventData[],
    pagination: r.json.pagination,
    error: null,
  };
}
