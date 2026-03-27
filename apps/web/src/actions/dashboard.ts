"use server";

import { cookies } from "next/headers";
import type { DashboardStats } from "@hvac-saas/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export async function getDashboardStats(params?: {
  from?: string;
  to?: string;
}): Promise<{
  data: DashboardStats | null;
  error: string | null;
}> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);

    const qs = searchParams.toString();
    const url = `${API_URL}/dashboard/stats${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch dashboard stats" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
