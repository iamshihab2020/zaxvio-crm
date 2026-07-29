/**
 * The only safe way to put a tenant logo on a PDF.
 *
 * `@react-pdf/renderer` resolves a remote `<Image src>` by **fetching it from
 * the API process**. `logoUrl` was validated as `z.string().url().max(2000)` —
 * any syntactically valid URL, including `http://169.254.169.254/latest/meta-data/`
 * or an internal service address. `GET /invoices/:id/pdf` is the trigger and
 * there was no fetch timeout, so it was both a blind SSRF probe and a
 * request-hang vector (INV-05). The same `<Image src={tenant.logoUrl} />` line
 * appears in `quote-pdf.tsx`, so this is fixed for both documents at once.
 *
 * The rule is the one [[security-rules]] §10 already applies to storage paths:
 * a logo must live in our own R2 public bucket, under the tenant's own prefix.
 * Anything else renders without a logo rather than reaching out to it.
 */

import { env } from "../env.js";

/** The exact prefix a legitimately-uploaded logo has, per `getPublicUrl`. */
function allowedPrefix(tenantId: string): string | null {
  const base = (env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/logos/${tenantId}/`;
}

/**
 * Return the logo URL only when it is one this system wrote.
 *
 * Rejects: a different host, a different tenant's prefix, a bucket other than
 * `logos`, anything with a traversal segment, and anything at all when R2 is
 * not configured.
 */
export function safeLogoUrl(
  logoUrl: string | null | undefined,
  tenantId: string | null | undefined,
): string | null {
  if (!logoUrl || !tenantId) return null;

  const prefix = allowedPrefix(tenantId);
  if (!prefix) return null;
  if (!logoUrl.startsWith(prefix)) return null;
  // `..` after the prefix would still resolve inside the bucket, but never in a
  // path we generated — treat it as tampering.
  if (logoUrl.includes("..")) return null;

  // Parse to be certain the origin is what the prefix implied and that no
  // credentials or non-http scheme slipped through.
  try {
    const parsed = new URL(logoUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password) return null;
  } catch {
    return null;
  }

  return logoUrl;
}

/**
 * Narrow a tenant row to what the PDF components render, with the logo already
 * checked. Keeps the guard from being something each PDF has to remember.
 */
export function withSafeLogo<T extends { id?: string; logoUrl: string | null }>(
  tenant: T | null | undefined,
  tenantId: string,
): T | null {
  if (!tenant) return null;
  return { ...tenant, logoUrl: safeLogoUrl(tenant.logoUrl, tenantId) };
}
