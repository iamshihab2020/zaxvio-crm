/**
 * Webhook secrets — minting, hashing, and comparing without leaking.
 *
 * ## The length oracle, which is the part people get wrong
 *
 * `crypto.timingSafeEqual` **throws** when its two buffers differ in length.
 * The obvious fix is to check the length first and return early — and that
 * early return is itself a timing signal: an attacker learns the secret's exact
 * length in a handful of requests, which turns a search over all strings into a
 * search over strings of one known length.
 *
 * So both inputs are hashed to a fixed 32 bytes first and the comparison is over
 * the digests. Every comparison then does identical work whatever was sent, and
 * the length check that remains is on the digest, where both sides are always 32
 * by construction. [[wf-10-security|§10.4]] calls for "length-padded
 * `timingSafeEqual` plus an explicit length check"; hashing is the padding.
 *
 * ## Why sha256 and not a password hash
 *
 * A webhook secret is a 32-byte random value we generated, not something a
 * human chose. bcrypt and argon2 exist to make *low-entropy* guesses expensive;
 * against 256 bits of randomness they buy nothing and cost a hundred
 * milliseconds on a path that runs on every inbound request. Different threat,
 * different tool.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The URL segment. Identifies an endpoint; does **not** authorise it. */
export function mintPathToken(): string {
  // base64url, so it survives a URL without escaping and reads as one token
  // rather than as a path with slashes in it.
  return randomBytes(18).toString("base64url");
}

/** The shared secret. Shown once, at creation, and never again. */
export function mintSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Last four characters, so a list of endpoints is distinguishable. */
export function secretHint(secret: string): string {
  return secret.slice(-4);
}

/**
 * A stable, non-reversible label for a secret, for logs.
 *
 * `sha256(secret).slice(0, 12)`. An operator correlating "which endpoint is
 * being hammered" needs something stable across requests; they do not need the
 * secret, and a log line is the single most-copied artifact in an incident.
 */
export function secretFingerprint(secret: string): string {
  return hashSecret(secret).slice(0, 12);
}

/**
 * Does the presented secret match the stored hash?
 *
 * Constant-time over fixed-length digests. See the docblock above for why the
 * naive length check is the bug.
 */
export function secretMatches(presented: string, storedHash: string): boolean {
  const a = createHash("sha256").update(presented, "utf8").digest();
  const b = Buffer.from(storedHash, "hex");

  // Both are 32 bytes by construction. A stored hash that is not is corrupt
  // data rather than a wrong secret, and refusing is the only safe reading.
  if (b.length !== a.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * HMAC-SHA256 over a body, hex. **For signing, where we hold the key.**
 *
 * ## Why this is `createHmac` and not `sha256(secret + body)`
 *
 * The obvious construction is a **secret-prefix MAC**, and SHA-256 is
 * Merkle–Damgård: its digest *is* its internal state. Anyone holding one valid
 * `(body, signature)` pair can resume from that state, append bytes, and produce
 * a valid signature for the extended body **without ever knowing the secret**.
 * A delimiter does not help — `secret.body` is just a longer prefix.
 *
 * HMAC exists precisely to close that: two keyed passes, so the digest is not a
 * resumable state for the message.
 *
 * This repo shipped the broken version first, on both the sending and the
 * checking side, with a comment describing them as "the same construction". They
 * were — consistently wrong.
 */
export function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Verify a signature we produced. Constant-time.
 *
 * **Not usable on the inbound path**, and that is not an oversight — see
 * `receive.ts`. Verifying an HMAC requires the verifier to hold the key, and
 * inbound secrets are stored as a hash on purpose. There is no arrangement in
 * which a hash-only verifier and a secret-holding sender agree.
 */
export function signatureMatches(
  body: string,
  presentedSignature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signBody(body, secret), "hex");

  // Tolerate the `sha256=` prefix GitHub- and Stripe-style senders use.
  const cleaned = presentedSignature.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-f]*$/i.test(cleaned)) return false;

  const presented = Buffer.from(cleaned, "hex");
  // Not an early return on a *secret* length — this is the length of something
  // the caller sent, which they already know.
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(presented, expected);
}

/**
 * Headers an automation may read.
 *
 * An **allowlist**, not a denylist. A denylist has to enumerate every header
 * that could ever carry a credential, and the one it misses is the one that
 * ends up interpolated into an email. `authorization`, `cookie` and
 * `x-internal-proxy-secret` are the obvious three; the point of the allowlist is
 * that the fourth does not need to be predicted.
 */
const ALLOWED_HEADERS: ReadonlySet<string> = new Set([
  "content-type",
  "user-agent",
  "x-request-id",
  "x-event-type",
  "x-event-id",
  "x-source",
]);

export function safeHeaders(
  headers: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase();
    if (!ALLOWED_HEADERS.has(name)) continue;
    if (typeof value === "string") out[name] = value.slice(0, 512);
    else if (Array.isArray(value) && typeof value[0] === "string") {
      out[name] = String(value[0]).slice(0, 512);
    }
  }
  return out;
}
