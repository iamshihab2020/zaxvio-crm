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

export async function getMaintenanceContracts(params?: {
  search?: string;
  page?: number;
  limit?: number;
  customerId?: string;
  equipmentId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    if (params?.equipmentId)
      searchParams.set("equipmentId", params.equipmentId);
    if (params?.isActive !== undefined)
      searchParams.set("isActive", String(params.isActive));
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/maintenance-contracts${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to fetch service agreements",
      };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getMaintenanceContract(id: string) {
  try {
    const res = await fetch(`${API_URL}/maintenance-contracts/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Service agreement not found",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createMaintenanceContract(data: {
  customerId: string;
  contractName: string;
  startDate: string;
  endDate: string;
  equipmentId?: string;
  frequency?: string;
  visitsPerYear?: number;
  annualPrice?: number;
  notes?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/maintenance-contracts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to create service agreement",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateMaintenanceContract(
  id: string,
  data: {
    contractName?: string;
    startDate?: string;
    endDate?: string;
    equipmentId?: string | null;
    frequency?: string;
    visitsPerYear?: number;
    annualPrice?: number | null;
    isActive?: boolean;
    notes?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/maintenance-contracts/${id}`, {
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
      return {
        data: null,
        error: err.message ?? "Failed to update service agreement",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteMaintenanceContract(id: string) {
  try {
    const res = await fetch(`${API_URL}/maintenance-contracts/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete service agreement" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function getExpiringContracts(params?: { days?: number }) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.days) searchParams.set("days", String(params.days));

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/maintenance-contracts/expiring${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to fetch expiring contracts",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== BULK OPERATIONS =====

export async function bulkDeleteContracts(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/maintenance-contracts/bulk-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: err.message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkToggleContractActive(ids: string[], isActive: boolean) {
  try {
    const res = await fetch(`${API_URL}/maintenance-contracts/bulk-toggle-active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids, isActive }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: err.message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}
