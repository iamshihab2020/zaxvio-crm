"use server";

import { cookies } from "next/headers";
import type {
  ReportGranularity,
  ReportSection,
  ReportSectionResponse,
} from "@hvac-saas/types";

import { API_URL } from "@/lib/api-url";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export interface ReportStatsParams {
  section: ReportSection;
  from?: string;
  to?: string;
  /** Omit to let the API pick a bucket size from the span. */
  granularity?: ReportGranularity;
}

export interface ReportStatsResult {
  /**
   * Discriminated on `section`, so the page narrows with a `switch` instead of
   * five `as RevenueReportData` casts over an `any`.
   */
  data: ReportSectionResponse | null;
  error: string | null;
}

export async function getReportStats(
  params: ReportStatsParams,
): Promise<ReportStatsResult> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("section", params.section);
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.granularity) searchParams.set("granularity", params.granularity);

    const url = `${API_URL}/reports/stats?${searchParams.toString()}`;

    const res = await fetch(url, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        data: null,
        error: err.message ?? `Failed to fetch report data (${res.status})`,
      };
    }

    const json = (await res.json()) as { data?: ReportSectionResponse };
    if (!json.data) {
      return { data: null, error: "The report response was empty" };
    }

    // The API echoes the section it resolved. If it ever disagrees with what we
    // asked for, the payload shape would not match the tab about to render it —
    // fail loudly here rather than let a chart read undefined fields.
    if (json.data.section !== params.section) {
      return {
        data: null,
        error: `Expected the ${params.section} report but received ${json.data.section}`,
      };
    }

    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
