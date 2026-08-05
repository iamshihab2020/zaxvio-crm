/**
 * Post-login redirect targets.
 *
 * `middleware.ts` only ever writes a pathname into `?callbackUrl=`, so every
 * value the app itself produces is already same-origin. But the value comes
 * back off the query string, and `/login` is public — an attacker just writes
 * their own. The victim then authenticates against the real origin and gets
 * handed to a page of the attacker's choosing, which is a good place to ask
 * them to "re-enter your password".
 *
 * Relative paths only. Three rejections that matter:
 *   - `https://evil.example`  — absolute, obviously
 *   - `//evil.example`        — protocol-relative; the browser reads this as a host
 *   - `/\evil.example`        — same thing. Browsers normalise the backslash to a
 *                               slash while parsing the authority, so `/\` is
 *                               `//`. Checking only for `//` misses it.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  // Second character decides host-vs-path; both slash forms mean "host".
  if (raw[1] === "/" || raw[1] === "\\") return fallback;
  return raw;
}
