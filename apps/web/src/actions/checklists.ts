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

export async function getChecklistTemplates(params?: {
  serviceType?: string;
  showInactive?: boolean;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.serviceType) searchParams.set("serviceType", params.serviceType);
    if (params?.showInactive) searchParams.set("showInactive", "true");

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/checklists${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch checklists" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getChecklistTemplate(id: string) {
  try {
    const res = await fetch(`${API_URL}/checklists/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Checklist template not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createChecklistTemplate(data: {
  name: string;
  serviceType: string;
  isActive?: boolean;
  items?: Array<{
    label: string;
    isRequired?: boolean;
    catalogItemId?: string | null;
    sortOrder?: number;
  }>;
}) {
  try {
    const res = await fetch(`${API_URL}/checklists`, {
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
      return { data: null, error: err.message ?? "Failed to create checklist" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateChecklistTemplate(
  id: string,
  data: {
    name?: string;
    serviceType?: string;
    isActive?: boolean;
  },
) {
  try {
    const res = await fetch(`${API_URL}/checklists/${id}`, {
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
      return { data: null, error: err.message ?? "Failed to update checklist" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteChecklistTemplate(id: string) {
  try {
    const res = await fetch(`${API_URL}/checklists/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete checklist" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function addChecklistItem(
  templateId: string,
  data: {
    label: string;
    isRequired?: boolean;
    catalogItemId?: string | null;
    sortOrder?: number;
  },
) {
  try {
    const res = await fetch(`${API_URL}/checklists/${templateId}/items`, {
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
      return { data: null, error: err.message ?? "Failed to add checklist item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateChecklistItem(
  templateId: string,
  itemId: string,
  data: {
    label?: string;
    isRequired?: boolean;
    catalogItemId?: string | null;
    sortOrder?: number;
  },
) {
  try {
    const res = await fetch(
      `${API_URL}/checklists/${templateId}/items/${itemId}`,
      {
        method: "PATCH",
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
      return { data: null, error: err.message ?? "Failed to update checklist item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteChecklistItem(templateId: string, itemId: string) {
  try {
    const res = await fetch(
      `${API_URL}/checklists/${templateId}/items/${itemId}`,
      {
        method: "DELETE",
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete checklist item" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}
