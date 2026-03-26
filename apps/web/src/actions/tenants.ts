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

/**
 * Get the current tenant's data.
 */
export async function getTenant() {
  try {
    const res = await fetch(`${API_URL}/tenants/current`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch tenant" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

/**
 * Update the current tenant's fields.
 */
export async function updateTenant(data: {
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  defaultTaxRate?: string;
  googleReviewUrl?: string;
  timezone?: string;
  licenseNumber?: string;
  invoicePaymentTerms?: string;
  invoicePaymentInstructions?: string;
  invoiceTermsConditions?: string;
  invoiceFooterMessage?: string;
  quoteTermsConditions?: string;
  quoteFooterMessage?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/tenants/current`, {
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
      return { data: null, error: err.message ?? "Failed to update tenant" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
