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
  logoUrl?: string;
  timezone?: string;
  licenseNumber?: string;
  invoicePaymentTerms?: string;
  invoicePaymentInstructions?: string;
  invoiceTermsConditions?: string;
  invoiceFooterMessage?: string;
  quoteTermsConditions?: string;
  quoteFooterMessage?: string;
  quoteOnlineAcceptanceEnabled?: boolean;
  quotePostAcceptanceScheduling?: boolean;
  quoteAutoConvertToJob?: boolean;
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

// ── Logo Upload ─────────────────────────

export async function uploadLogo(data: {
  base64: string;
  filename: string;
  mimeType: string;
}) {
  try {
    const res = await fetch(`${API_URL}/tenants/current/logo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({
        data: data.base64,
        filename: data.filename,
        mimeType: data.mimeType,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to upload logo" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function removeLogo() {
  try {
    const res = await fetch(`${API_URL}/tenants/current/logo`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to remove logo" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── Impersonation (Tenant-side) ─────────────────────────

export async function respondToImpersonation(
  sessionId: string,
  approved: boolean,
) {
  try {
    const res = await fetch(`${API_URL}/tenants/impersonation/respond`, {
      method: "POST",
      headers: {
        cookie: await getCookieHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, approved }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to respond" };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function getPendingImpersonationRequest() {
  try {
    const res = await fetch(`${API_URL}/tenants/impersonation/pending`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      return { data: null, error: "Failed to check" };
    }

    const json = await res.json();
    return { data: json, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getActiveImpersonationViewer() {
  try {
    const res = await fetch(`${API_URL}/tenants/impersonation/active-viewer`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      return { data: null, error: "Failed to check" };
    }

    const json = await res.json();
    return { data: json, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
