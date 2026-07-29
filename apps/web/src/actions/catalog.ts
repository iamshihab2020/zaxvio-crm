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

export async function getCatalogItems(params?: {
  search?: string;
  page?: number;
  limit?: number;
  itemType?: string;
  showArchived?: boolean;
  sortBy?: string;
  sortOrder?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.itemType) searchParams.set("itemType", params.itemType);
    if (params?.showArchived) searchParams.set("showArchived", "true");
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/catalog${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch catalog items" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getCatalogCategories() {
  try {
    const res = await fetch(`${API_URL}/catalog/categories`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch categories" };
    }

    const json = await res.json();
    return { data: json.data as string[], error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getCatalogItem(id: string) {
  try {
    const res = await fetch(`${API_URL}/catalog/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Catalog item not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createCatalogItem(data: {
  name: string;
  itemType: string;
  unitPrice: number;
  unit?: string;
  category?: string;
  description?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/catalog`, {
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
      return { data: null, error: err.message ?? "Failed to create catalog item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateCatalogItem(
  id: string,
  data: {
    name?: string;
    itemType?: string;
    unitPrice?: number;
    unit?: string;
    category?: string;
    description?: string;
    isActive?: boolean;
  },
) {
  try {
    const res = await fetch(`${API_URL}/catalog/${id}`, {
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
      return { data: null, error: err.message ?? "Failed to update catalog item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteCatalogItem(id: string) {
  try {
    const res = await fetch(`${API_URL}/catalog/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete catalog item" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== BULK OPERATIONS =====

export async function bulkDeleteCatalogItems(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/catalog/bulk-delete`, {
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

export async function bulkToggleCatalogActive(ids: string[], isActive: boolean) {
  try {
    const res = await fetch(`${API_URL}/catalog/bulk-toggle-active`, {
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
