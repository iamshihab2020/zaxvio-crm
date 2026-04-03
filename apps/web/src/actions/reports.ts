"use server";

import { cookies } from "next/headers";
import type { ReportSection } from "@hvac-saas/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export async function getReportStats(params: {
  section: ReportSection;
  from?: string;
  to?: string;
}): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  error: string | null;
}> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("section", params.section);
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);

    const url = `${API_URL}/reports/stats?${searchParams.toString()}`;

    const res = await fetch(url, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch report data" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
