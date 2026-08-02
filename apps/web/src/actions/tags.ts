"use server";

import type { Tag } from "@hvac-saas/types";
import { apiGet, apiSend, apiVoid } from "@/lib/api-fetch";

/**
 * `Tag` is the Drizzle-inferred row, so these stay correct if the column set
 * changes. The ARC-02 migration left `getTags` at `apiGet<unknown[]>` and
 * `createTag` at a bare `apiSend` — with no type argument `T` resolves to
 * `unknown`, which narrows to `{}` after a truthy check, so every read of
 * `res.data.id` / `.name` / `.color` in `customer-tags-input.tsx` failed to
 * compile. Type arguments are not decoration here: they are the only thing
 * carrying the shape across the server-action boundary.
 */

export async function getTags() {
  return apiGet<Tag[]>("/tags", { fallback: "Failed to fetch tags" });
}

export async function createTag(name: string, color?: string) {
  return apiSend<Tag>("/tags", "POST", { name, color }, {
    fallback: "Failed to create tag",
  });
}

export async function updateTag(id: string, name: string, color?: string) {
  return apiSend<Tag>(`/tags/${id}`, "PATCH", { name, color }, {
    fallback: "Failed to update tag",
  });
}

export async function deleteTag(id: string) {
  return apiVoid(`/tags/${id}`, "DELETE", undefined, {
    fallback: "Failed to delete tag",
  });
}
