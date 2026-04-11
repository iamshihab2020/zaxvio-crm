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

export async function getEquipment(params?: {
  search?: string;
  page?: number;
  limit?: number;
  customerId?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/equipment${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch equipment" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getEquipmentItem(id: string) {
  try {
    const res = await fetch(`${API_URL}/equipment/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Equipment not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createEquipment(data: {
  customerId: string;
  equipmentType: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  warrantyExpiry?: string;
  location?: string;
  notes?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/equipment`, {
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
      return { data: null, error: err.message ?? "Failed to create equipment" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateEquipment(
  id: string,
  data: {
    equipmentType?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    installDate?: string;
    warrantyExpiry?: string;
    location?: string;
    notes?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/equipment/${id}`, {
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
      return { data: null, error: err.message ?? "Failed to update equipment" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteEquipment(id: string) {
  try {
    const res = await fetch(`${API_URL}/equipment/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete equipment" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function getEquipmentRefrigerantLogs(
  equipmentId: string,
  params?: { page?: number; limit?: number },
) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/equipment/${equipmentId}/refrigerant-logs${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to fetch refrigerant logs",
      };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createRefrigerantLog(
  equipmentId: string,
  data: {
    refrigerantType: string;
    action: string;
    quantity: number;
    unit?: string;
    technicianName?: string;
    epaCertNumber?: string;
    jobId?: string;
    notes?: string;
  },
) {
  try {
    const res = await fetch(
      `${API_URL}/equipment/${equipmentId}/refrigerant-logs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: await getCookieHeader(),
        },
        body: JSON.stringify(data),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to create refrigerant log",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== BULK OPERATIONS =====

export async function bulkArchiveEquipment(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/equipment/bulk-archive`, {
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

export async function bulkRestoreEquipment(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/equipment/bulk-restore`, {
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

export async function bulkDeleteEquipment(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/equipment/bulk-delete`, {
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
