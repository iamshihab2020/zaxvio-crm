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

/**
 * Idempotent call to ensure a tenant row exists for the active organization.
 * Used as a fallback when the afterCreate hook fails silently.
 */
export async function initializeTenant(): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(`${API_URL}/tenants/initialize`, {
      method: "POST",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.message ?? "Failed to initialize tenant",
      };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}
