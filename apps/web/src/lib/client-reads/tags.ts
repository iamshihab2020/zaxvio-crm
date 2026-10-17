/**
 * Browser reads for tags: the TanStack Query side of `@/actions/tags`.
 * Mirrors the server action exactly, including its `Tag[]` typing; see
 * lib/api-client.ts for why reads moved off server actions.
 */
import type { Tag } from "@hvac-saas/types";
import { readResult } from "@/lib/api-client";

export async function getTags() {
  return readResult<Tag[]>("/tags", "Failed to fetch tags");
}
