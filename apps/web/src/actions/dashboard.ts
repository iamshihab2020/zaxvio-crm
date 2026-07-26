"use server";

import { cookies } from "next/headers";
import type { DashboardStats, DashboardPipelineItem } from "@hvac-saas/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Without a deadline a hung API blocks the RSC render indefinitely — no TTFB, no
 * error, just a blank tab. 15s is well past the p99 for a cached dashboard.
 */
const REQUEST_TIMEOUT_MS = 15_000;

export interface DashboardStatsParams {
  from?: string;
  to?: string;
  granularity?: "day" | "week" | "month";
}

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function apiGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? `Request failed (${res.status})` };
    }

    const json = await res.json();
    return { data: json.data as T, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { data: null, error: "The dashboard took too long to respond." };
    }
    return { data: null, error: "Network error" };
  }
}

export async function getDashboardStats(
  params?: DashboardStatsParams,
): Promise<{ data: DashboardStats | null; error: string | null }> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.granularity) searchParams.set("granularity", params.granularity);

  const qs = searchParams.toString();
  return apiGet<DashboardStats>(`/dashboard/stats${qs ? `?${qs}` : ""}`);
}

/**
 * Pipeline stage distribution only. Separate from `getDashboardStats` so switching
 * pipelines repaints one panel instead of re-running the whole dashboard.
 */
export async function getDashboardPipeline(
  pipelineId?: string | null,
): Promise<{ data: DashboardPipelineItem[] | null; error: string | null }> {
  const qs = pipelineId ? `?pipelineId=${encodeURIComponent(pipelineId)}` : "";
  return apiGet<DashboardPipelineItem[]>(`/dashboard/pipeline${qs}`);
}
