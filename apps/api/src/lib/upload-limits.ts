/**
 * Upload size limits, in one place, because the number a handler checks and the
 * number Fastify enforces are not the same number and drifting them apart
 * silently disables the feature.
 *
 * Fastify's `bodyLimit` defaults to **1 MB** when not configured, and it rejects
 * with `FST_ERR_CTP_BODY_TOO_LARGE` *before* the route handler runs — so a
 * handler's own "max 20 MB" check never executes and never gets a chance to
 * return its friendly 400. Two endpoints shipped this way: job attachments
 * (handler said 20 MB / 50 MB, modal said "Max 20MB") and the tenant logo
 * (handler said 2 MB). Both had a real ceiling of ~786 KB.
 *
 * These payloads are base64 inside a JSON envelope, so the wire size is about
 * 4/3 of the file plus the surrounding keys. `bodyLimitFor()` does that maths so
 * a route's `bodyLimit` is always derived from its advertised limit rather than
 * guessed alongside it.
 */

export const MB = 1024 * 1024;

/** Advertised ceilings. These are the numbers the UI is allowed to promise. */
export const UPLOAD_LIMITS = {
  photo: 20 * MB,
  document: 50 * MB,
  logo: 2 * MB,
} as const;

/** Base64 is 4 bytes per 3, plus a little room for the JSON keys around it. */
export function bodyLimitFor(maxFileBytes: number): number {
  return Math.ceil((maxFileBytes * 4) / 3) + 64 * 1024;
}

/**
 * Decoded byte length of a base64 string, computed from the string itself so an
 * oversize payload can be rejected without allocating a second large Buffer.
 */
export function base64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / MB)}MB`;
}

/**
 * What a job attachment is allowed to be.
 *
 * The upload took any `mimeType` string and passed it straight to R2 as the
 * object's Content-Type, then handed back a public URL. Uploading `text/html`
 * therefore produced attacker-controlled HTML served from the app's own storage
 * domain — stored XSS with a URL the product itself generated. An allowlist
 * already existed for tenant logos (`schemas/tenants.ts`, added when SVG was
 * blocked); it was never applied here.
 *
 * SVG is deliberately excluded: it is an image to a user and a script host to a
 * browser, which is the same reason the logo allowlist drops it.
 */
export const ALLOWED_UPLOAD_MIME = [
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export function isAllowedUploadMime(mime: string): boolean {
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(
    mime.split(";")[0].trim().toLowerCase(),
  );
}

/**
 * Base64 that decodes to nothing usable should be refused at the edge rather
 * than written to storage as garbage. `Buffer.from` never throws — it silently
 * ignores invalid characters — so the check has to be explicit.
 */
export function isValidBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}
