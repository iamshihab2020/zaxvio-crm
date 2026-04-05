/**
 * Convert a Supabase Storage path to a public URL.
 * storagePath format: "{tenantId}/jobs/{jobId}/{filename}"
 * bucket: "job-attachments"
 */
export function getStorageUrl(storagePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/job-attachments/${storagePath}`;
}
