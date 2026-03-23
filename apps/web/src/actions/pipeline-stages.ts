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

export async function getPipelineStages() {
  try {
    const res = await fetch(`${API_URL}/pipeline-stages`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch pipeline stages" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createPipelineStage(data: {
  label: string;
  color?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/pipeline-stages`, {
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
      return { data: null, error: err.message ?? "Failed to create stage" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updatePipelineStage(
  id: string,
  data: { label?: string; color?: string },
) {
  try {
    const res = await fetch(`${API_URL}/pipeline-stages/${id}`, {
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
      return { data: null, error: err.message ?? "Failed to update stage" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deletePipelineStage(id: string) {
  try {
    const res = await fetch(`${API_URL}/pipeline-stages/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete stage" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function reorderPipelineStages(order: string[]) {
  try {
    const res = await fetch(`${API_URL}/pipeline-stages/reorder`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ order }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to reorder stages" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}
