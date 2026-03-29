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

// ── Dashboard (combined endpoint) ────────────────────────

export async function getAdminDashboard() {
  try {
    const res = await fetch(`${API_URL}/admin/dashboard`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch dashboard" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── Tenants ──────────────────────────────────────────────

export async function getAdminTenants(params?: {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/admin/tenants${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch tenants" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getAdminTenant(id: string) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}`, {
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

export async function getAdminTenantAnalytics(id: string) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}/analytics`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch analytics" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── Tenant Actions ───────────────────────────────────────

export async function deactivateTenant(id: string) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}/deactivate`, {
      method: "POST",
      headers: { cookie: await getCookieHeader() },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to deactivate" };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function activateTenant(id: string) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}/activate`, {
      method: "POST",
      headers: { cookie: await getCookieHeader() },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to activate" };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function extendTrial(id: string, days: number) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}/extend-trial`, {
      method: "POST",
      headers: {
        cookie: await getCookieHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ days }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to extend trial" };
    }

    const json = await res.json();
    return { success: true, trialEndsAt: json.trialEndsAt, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function overrideSubscription(
  id: string,
  data: { status?: string; planName?: string },
) {
  try {
    const res = await fetch(
      `${API_URL}/admin/tenants/${id}/override-subscription`,
      {
        method: "POST",
        headers: {
          cookie: await getCookieHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to override" };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function editTenant(
  id: string,
  data: Record<string, unknown>,
) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}`, {
      method: "PATCH",
      headers: {
        cookie: await getCookieHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to edit tenant" };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function deleteTenant(id: string, confirmBusinessName: string) {
  try {
    const res = await fetch(`${API_URL}/admin/tenants/${id}`, {
      method: "DELETE",
      headers: {
        cookie: await getCookieHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmBusinessName }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? "Failed to delete tenant" };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Network error" };
  }
}

// ── Analytics ────────────────────────────────────────────

export async function getAdminMRR() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics/mrr`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch MRR" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getAdminSignups() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics/signups`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch signups" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getActiveUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics/active-users`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch active users" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getTrialConversion() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics/trial-conversion`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch trial data" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getChurnList(days?: number) {
  try {
    const qs = days ? `?days=${days}` : "";
    const res = await fetch(`${API_URL}/admin/analytics/churn${qs}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch churn data" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── Audit & Support ──────────────────────────────────────

export async function getAuditLog(params?: {
  page?: number;
  limit?: number;
  action?: string;
  adminUserId?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.action) searchParams.set("action", params.action);
    if (params?.adminUserId) searchParams.set("adminUserId", params.adminUserId);

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/admin/audit-log${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch audit log" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getImpersonationLog(params?: {
  page?: number;
  limit?: number;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/admin/impersonation-log${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch log" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getTenantActivity(
  tenantId: string,
  params?: { page?: number; limit?: number },
) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/admin/tenants/${tenantId}/activity${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch activity" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── Search ───────────────────────────────────────────────

export async function adminSearch(query: string) {
  try {
    const res = await fetch(
      `${API_URL}/admin/search?q=${encodeURIComponent(query)}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Search failed" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── System ───────────────────────────────────────────────

export async function getSystemHealth() {
  try {
    const res = await fetch(`${API_URL}/admin/system`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch system health" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getWebhookLogs(limit?: number) {
  try {
    const qs = limit ? `?limit=${limit}` : "";
    const res = await fetch(`${API_URL}/admin/system/webhooks${qs}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch webhooks" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getCronHistory(limit?: number) {
  try {
    const qs = limit ? `?limit=${limit}` : "";
    const res = await fetch(`${API_URL}/admin/system/crons${qs}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch cron history" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── Combined Analytics ───────────────────────────────────

export async function getAdminAnalytics() {
  try {
    const cookie = await getCookieHeader();
    const [mrr, signups, active, funnel, churn, inactive, adoption] =
      await Promise.all([
        fetch(`${API_URL}/admin/analytics/mrr`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/signups`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/active-users`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/trial-conversion`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/churn?days=90`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/inactive-alerts`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/feature-adoption`, { headers: { cookie }, cache: "no-store" }).then(r => r.json()),
      ]);

    return {
      data: {
        mrr: mrr.data ?? null,
        signups: signups.data ?? null,
        activeUsers: active.data ?? null,
        trialConversion: funnel.data ?? null,
        churnList: churn.data ?? null,
        inactiveAlerts: inactive.data ?? null,
        featureAdoption: adoption.data ?? null,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ── P1 Analytics ─────────────────────────────────────────

export async function getInactiveAlerts() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics/inactive-alerts`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch inactive alerts" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getFeatureAdoption() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics/feature-adoption`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch feature adoption" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
