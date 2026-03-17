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

export async function getTags() {
  try {
    const res = await fetch(`${API_URL}/tags`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch tags" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createTag(name: string, color?: string) {
  try {
    const res = await fetch(`${API_URL}/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ name, color }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to create tag" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateTag(id: string, name: string, color?: string) {
  try {
    const res = await fetch(`${API_URL}/tags/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ name, color }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update tag" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteTag(id: string) {
  try {
    const res = await fetch(`${API_URL}/tags/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete tag" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}
