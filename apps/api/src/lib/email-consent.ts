/**
 * Customer email consent — **one gate, not N call sites**.
 *
 * DF-NOT-01. The defect this repo keeps repeating is a rule applied in one
 * place and never swept: `escapeLike` lived privately inside `routes/jobs` while
 * six other route files interpolated user input into `ilike` unescaped;
 * "overdue" had three definitions that disagreed, so a partially-paid invoice
 * past its due date was shown as overdue everywhere and chased nowhere. A
 * suppression check is the worst possible candidate for that pattern, because
 * the failure is invisible from inside the system and extremely visible to the
 * person receiving mail they asked to stop.
 *
 * So there is exactly one function that answers "may we email this customer",
 * and every automated send goes through it.
 *
 * ## Transactional sends are exempt, and the exemption is explicit
 *
 * A quote you asked for, an invoice you owe, a receipt for money you paid — none
 * of those needs consent, and suppressing them would be worse for the recipient
 * than sending them. But the exemption is an **argument you pass**, never an
 * omission: `canEmailCustomer(db, { …, purpose: "transactional" })`. The next
 * person adding a send has to state which kind it is, and "I forgot" produces a
 * type error rather than an unlawful send.
 *
 * ## The token is derived, not stored
 *
 * HMAC-SHA256 of `tenantId:customerId` under `BETTER_AUTH_SECRET`, which
 * `lib/env.ts` already validates at ≥32 characters. Nothing to store, nothing
 * to backfill, nothing extra to leak in a table dump, and rotating the secret
 * invalidates every outstanding link at once. It is bound to the tenant as well
 * as the customer so a token cannot be replayed across a tenant boundary even
 * if a customer id were somehow shared.
 */

import crypto from "node:crypto";
import { customers, and, eq, isNull, type getDb } from "@hvac-saas/database";
import { env } from "./env.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Why we are sending.
 *
 * - `marketing` — a review request, a renewal nudge, anything a workflow sends.
 *   Gated. This is the default in every sense that matters: if you are unsure
 *   which one you have, you have this one.
 * - `transactional` — a document the customer is party to, or a direct reply to
 *   something they did. Ungated, and the caller has to say so.
 */
export type EmailPurpose = "marketing" | "transactional";

export interface ConsentDecision {
  allowed: boolean;
  /**
   * Plain language, written for the person reading a run log — not a code.
   * "This customer unsubscribed on 12 July, so we didn't email them" is the
   * whole point of `node_execution_logs.skip_reason`.
   */
  reason: string;
  /** The address to send to. Null whenever `allowed` is false. */
  email: string | null;
}

const ALLOWED: (email: string) => ConsentDecision = (email) => ({
  allowed: true,
  reason: "Customer has not opted out",
  email,
});

/**
 * May we send this customer a non-transactional email, and to what address?
 *
 * Returns a decision rather than a boolean because every caller needs the
 * address anyway, and because the *reason* is what gets written into a node log
 * or a delivery row. A bare `false` forces the caller to invent an explanation,
 * and invented explanations are how "email failed" ends up covering four
 * unrelated situations.
 *
 * Tenant-scoped, like every read in this codebase. A customer id arriving from
 * a workflow config is client-supplied data exactly like a request body, and
 * there is no row-level security underneath it.
 */
export async function canEmailCustomer(
  db: Db,
  params: {
    tenantId: string;
    customerId: string;
    purpose: EmailPurpose;
  },
): Promise<ConsentDecision> {
  const [row] = await db
    .select({
      email: customers.email,
      optOutAt: customers.emailOptOutAt,
      archivedAt: customers.archivedAt,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, params.tenantId),
        eq(customers.id, params.customerId),
      ),
    );

  if (!row) {
    return {
      allowed: false,
      reason: "This customer no longer exists",
      email: null,
    };
  }

  // No address is not a consent decision, but it is the same outcome and the
  // caller needs it distinguished — "they unsubscribed" and "we never had an
  // address" lead to different fixes.
  if (!row.email) {
    return {
      allowed: false,
      reason: "This customer has no email address on file",
      email: null,
    };
  }

  // Transactional mail is exempt from the opt-out but not from existing. A
  // deleted customer or a missing address still stops the send.
  if (params.purpose === "transactional") {
    return ALLOWED(row.email);
  }

  if (row.optOutAt) {
    return {
      allowed: false,
      reason: `This customer unsubscribed on ${formatOptOutDate(row.optOutAt)}, so we did not email them`,
      email: null,
    };
  }

  // An archived customer is one the tenant has put away. Sending them automated
  // marketing is not something a tenant would expect from archiving, and the
  // archive is the closest thing the product has to "stop dealing with this
  // record". Transactional mail still goes, because an archived customer can
  // still owe an invoice.
  if (row.archivedAt) {
    return {
      allowed: false,
      reason: "This customer is archived, so automated email is not sent to them",
      email: null,
    };
  }

  return ALLOWED(row.email);
}

/** `12 July 2026` — readable in a log line, unambiguous across locales. */
function formatOptOutDate(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// The unsubscribe token
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `<customerId>.<hmac>` — url-safe base64, no padding.
 *
 * The customer id travels in the clear because the route has to know which row
 * to look up without a table scan, and it is not a secret: it is a random v4
 * UUID that appears in this customer's own dashboard URLs. The signature is
 * what makes the link unforgeable, and it covers the tenant id too, so a token
 * is valid for exactly one (tenant, customer) pair.
 */
export function makeUnsubscribeToken(
  tenantId: string,
  customerId: string,
): string {
  return `${customerId}.${sign(tenantId, customerId)}`;
}

export interface UnsubscribeTokenClaim {
  customerId: string;
}

/**
 * Verify a token against a tenant. Returns null for anything that does not
 * check out — malformed, wrong tenant, tampered signature.
 *
 * The public route does not know the tenant up front, so it resolves the
 * customer row by id **first** and verifies against that row's tenant. That is
 * safe precisely because the signature covers the tenant: a token minted for
 * tenant A cannot verify against the row it names if that row belongs to B.
 */
export function parseUnsubscribeToken(token: string): UnsubscribeTokenClaim | null {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;

  const customerId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!UUID_PATTERN.test(customerId) || signature.length === 0) return null;

  return { customerId };
}

/**
 * Constant-time check that `token` is the token for this (tenant, customer).
 *
 * `timingSafeEqual` throws on a length mismatch, so the lengths are compared
 * first — and that comparison is deliberately *not* constant time, because the
 * length of an HMAC-SHA256 digest is a public constant and leaks nothing.
 */
export function verifyUnsubscribeToken(
  token: string,
  tenantId: string,
  customerId: string,
): boolean {
  const separator = token.indexOf(".");
  if (separator <= 0) return false;
  if (token.slice(0, separator) !== customerId) return false;

  const provided = Buffer.from(token.slice(separator + 1), "utf8");
  const expected = Buffer.from(sign(tenantId, customerId), "utf8");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(tenantId: string, customerId: string): string {
  return crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`unsubscribe:${tenantId}:${customerId}`)
    .digest("base64url");
}

/** The one-click link that goes in an email footer and the `List-Unsubscribe` header. */
export function unsubscribeUrl(tenantId: string, customerId: string): string {
  return `${env.FRONTEND_URL}/unsubscribe/${makeUnsubscribeToken(tenantId, customerId)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recording the decision
// ─────────────────────────────────────────────────────────────────────────────

export type OptOutSource =
  | "unsubscribe_link"
  | "manual"
  | "complaint"
  | "import";

/**
 * Record an opt-out. Idempotent: a customer who unsubscribes twice keeps the
 * **first** timestamp, because that is the date they will quote at you.
 *
 * Returns whether this call was the one that changed something, so the route
 * can tell a first unsubscribe from a repeat click without a second query —
 * both render the same confirmation page, but only one is worth an activity row.
 */
export async function optOutCustomer(
  db: Db,
  params: {
    tenantId: string;
    customerId: string;
    source: OptOutSource;
  },
): Promise<{ changed: boolean }> {
  const rows = await db
    .update(customers)
    .set({
      emailOptOutAt: new Date(),
      emailOptOutSource: params.source,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customers.tenantId, params.tenantId),
        eq(customers.id, params.customerId),
        // The idempotency, expressed as a predicate rather than a read-then-write:
        // two concurrent clicks cannot both believe they were the first.
        isNull(customers.emailOptOutAt),
      ),
    )
    .returning({ id: customers.id });

  return { changed: rows.length > 0 };
}

/**
 * Undo an opt-out. Not reachable from the public link — resubscribing has to be
 * a deliberate act by the tenant with the customer's say-so, and a one-click
 * "resubscribe" URL sitting in an old email is a way to undo consent by
 * accident (or by a forwarded message).
 */
export async function clearOptOut(
  db: Db,
  params: { tenantId: string; customerId: string },
): Promise<{ changed: boolean }> {
  const rows = await db
    .update(customers)
    .set({
      emailOptOutAt: null,
      emailOptOutSource: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customers.tenantId, params.tenantId),
        eq(customers.id, params.customerId),
      ),
    )
    .returning({ id: customers.id });

  return { changed: rows.length > 0 };
}
