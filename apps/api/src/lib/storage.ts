import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { env } from "./env.js";

/**
 * Object storage on Cloudflare R2 (S3-compatible).
 *
 * Replaces Supabase Storage. See docs/claude/reference/decisions.md (ADR-001).
 *
 * Two physical buckets, because public-vs-private is a per-bucket setting in R2:
 *   public  — served straight to the browser by URL (job photos, tenant logos)
 *   private — streamed through the API only (invoice + quote PDFs)
 * Merging them would make invoice PDFs reachable by anyone who guessed a path.
 *
 * The `bucket` argument keeps the logical names the old Supabase call sites
 * used, so it stays obvious which files live where.
 */

export type StorageBucket = "job-attachments" | "logos" | "invoices" | "quotes";

const BUCKET_VISIBILITY: Record<StorageBucket, "public" | "private"> = {
  "job-attachments": "public",
  logos: "public",
  invoices: "private",
  quotes: "private",
};

export function isStorageConfigured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_PUBLIC_BUCKET &&
      env.R2_PRIVATE_BUCKET &&
      env.R2_PUBLIC_URL,
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error(
      "R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET and R2_PUBLIC_URL in .env",
    );
  }

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return client;
}

function physicalBucket(bucket: StorageBucket): string {
  const name =
    BUCKET_VISIBILITY[bucket] === "public" ? env.R2_PUBLIC_BUCKET : env.R2_PRIVATE_BUCKET;
  if (!name) {
    throw new Error(`R2 bucket for "${bucket}" is not configured`);
  }
  return name;
}

/**
 * Both logical buckets share a physical bucket, so the logical name becomes a
 * key prefix. Storage paths recorded in the database stay unchanged.
 */
function objectKey(bucket: StorageBucket, storagePath: string): string {
  return `${bucket}/${storagePath}`;
}

/** Upload a file. Throws on failure so callers can return a 500. */
export async function uploadFile(
  bucket: StorageBucket,
  storagePath: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: physicalBucket(bucket),
      Key: objectKey(bucket, storagePath),
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Download a file. Returns null when the object is missing, so callers can fall back. */
export async function downloadFile(
  bucket: StorageBucket,
  storagePath: string,
): Promise<Buffer | null> {
  try {
    const result = await getClient().send(
      new GetObjectCommand({
        Bucket: physicalBucket(bucket),
        Key: objectKey(bucket, storagePath),
      }),
    );

    if (!result.Body) return null;
    return Buffer.from(await result.Body.transformToByteArray());
  } catch (error) {
    // Missing object is expected (e.g. PDFs are regenerated on demand).
    console.error(`[storage] download failed for ${bucket}/${storagePath}:`, error);
    return null;
  }
}

/** Best-effort delete. Never throws — cleanup must not fail the request. */
export async function deleteFiles(
  bucket: StorageBucket,
  storagePaths: string[],
): Promise<void> {
  if (storagePaths.length === 0) return;

  try {
    await getClient().send(
      new DeleteObjectsCommand({
        Bucket: physicalBucket(bucket),
        Delete: {
          Objects: storagePaths.map((path) => ({ Key: objectKey(bucket, path) })),
        },
      }),
    );
  } catch (error) {
    console.error(`[storage] delete failed for ${bucket}:`, error);
  }
}

/** Public URL for a file in a public bucket. Private buckets are streamed through the API instead. */
export function getPublicUrl(bucket: StorageBucket, storagePath: string): string {
  if (BUCKET_VISIBILITY[bucket] !== "public") {
    throw new Error(`Bucket "${bucket}" is private — stream it through the API instead`);
  }
  const base = (env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return `${base}/${objectKey(bucket, storagePath)}`;
}
