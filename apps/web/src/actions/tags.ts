"use server";

import { apiGet, apiSend, apiVoid } from "@/lib/api-fetch";

export async function getTags() {
  return apiGet<unknown[]>("/tags", { fallback: "Failed to fetch tags" });
}

export async function createTag(name: string, color?: string) {
  return apiSend("/tags", "POST", { name, color }, {
    fallback: "Failed to create tag",
  });
}

export async function updateTag(id: string, name: string, color?: string) {
  return apiSend(`/tags/${id}`, "PATCH", { name, color }, {
    fallback: "Failed to update tag",
  });
}

export async function deleteTag(id: string) {
  return apiVoid(`/tags/${id}`, "DELETE", undefined, {
    fallback: "Failed to delete tag",
  });
}
