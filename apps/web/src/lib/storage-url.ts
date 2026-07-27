import { getClientEnv } from "./env";

/**
 * Convert a stored job-attachment path to its public R2 URL.
 * storagePath format: "{tenantId}/jobs/{jobId}/{filename}"
 *
 * Mirrors getPublicUrl("job-attachments", path) in apps/api/src/lib/storage.ts —
 * the logical bucket name is the key prefix inside the public R2 bucket.
 */
export function getStorageUrl(storagePath: string): string {
  const { NEXT_PUBLIC_R2_PUBLIC_URL } = getClientEnv();
  if (!NEXT_PUBLIC_R2_PUBLIC_URL) return "";
  return `${NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, "")}/job-attachments/${storagePath}`;
}
