/**
 * The public unsubscribe surface. No auth — the token is the authorisation.
 *
 * Three endpoints, and the split between them is the whole design:
 *
 * - `GET /:token` — **reads nothing into a decision.** Returns who the link is
 *   for so the page can say "Stop emails from Shihab Housing to dana@…?"
 *   Crucially it does *not* opt anyone out, because Gmail, Outlook and every
 *   corporate link scanner fetch URLs in the background. A `GET` that
 *   unsubscribes is a `GET` that unsubscribes people who never clicked.
 * - `POST /:token` — the actual opt-out. Idempotent: a second click is a 200
 *   with the same page, not an error, because "you are already unsubscribed"
 *   reads as a failure to someone who just wants it to stop.
 * - `POST /:token/one-click` — RFC 8058. Gmail and Yahoo require bulk senders
 *   to support `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and the
 *   mail client posts to it directly with no browser and no page. Same effect,
 *   different response.
 *
 * Rate limits copied from `routes/public/booking.ts` ([[security-rules]] §4).
 * They are not really about abuse here — an attacker who forges a token has
 * broken HMAC-SHA256 and unsubscribing someone is the least of it — but an
 * unauthenticated endpoint with no limit is how a scraper walks the id space
 * looking for a 200, and a 404-vs-200 difference is information.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  getDb,
  customers,
  customerActivities,
  tenants,
  and,
  eq,
} from "@hvac-saas/database";
import {
  optOutCustomer,
  parseUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../lib/email-consent.js";
import { unsubscribeTokenParam } from "../../lib/schemas/public-unsubscribe.js";

/** Reads are cheap and a page reload is normal. */
const VIEW_LIMIT = { max: 30, timeWindow: "1 minute" } as const;
/** The mutation. Ten is far more than a person clicks and far fewer than a sweep. */
const ACT_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

interface ResolvedToken {
  tenantId: string;
  customerId: string;
  businessName: string;
  email: string | null;
  alreadyOptedOut: boolean;
}

const publicUnsubscribeRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * RFC 8058 clients post `List-Unsubscribe=One-Click` as
   * `application/x-www-form-urlencoded`, and this server registers no form-body
   * parser — so without this the one-click endpoint would answer every mail
   * provider with `415 Unsupported Media Type` and the unsubscribe control in
   * Gmail would simply never work.
   *
   * The body carries nothing the token does not, so it is consumed and
   * discarded rather than parsed. Registered inside this plugin, so it is
   * encapsulated to these routes and does not quietly teach the whole API to
   * accept form posts.
   */
  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, _body, done) => done(null, {}),
  );

  /**
   * Resolve a token to the customer it names, or null.
   *
   * The route does not know the tenant up front, so it looks the customer row up
   * by id and verifies the signature **against that row's tenant**. That is safe
   * precisely because the signature covers the tenant id: a token minted for
   * tenant A cannot verify against a row belonging to B, so the lookup cannot be
   * used to confirm that an id exists in some other tenant.
   *
   * Every failure returns null and every null renders the same 404. A distinct
   * "customer not found" and "bad signature" would let someone probe the id
   * space; there is nothing useful to tell an unauthenticated caller here.
   */
  async function resolve(token: string): Promise<ResolvedToken | null> {
    const claim = parseUnsubscribeToken(token);
    if (!claim) return null;

    const db = getDb();
    const [row] = await db
      .select({
        id: customers.id,
        tenantId: customers.tenantId,
        email: customers.email,
        optOutAt: customers.emailOptOutAt,
        businessName: tenants.businessName,
      })
      .from(customers)
      .innerJoin(tenants, eq(customers.tenantId, tenants.id))
      .where(eq(customers.id, claim.customerId));

    if (!row) return null;
    if (!verifyUnsubscribeToken(token, row.tenantId, row.id)) return null;

    return {
      tenantId: row.tenantId,
      customerId: row.id,
      businessName: row.businessName,
      email: row.email,
      alreadyOptedOut: row.optOutAt !== null,
    };
  }

  /**
   * Record the opt-out and, if it changed anything, leave a trail on the
   * customer. The activity row is what answers "when did they unsubscribe" from
   * inside the app, next to everything else that ever happened to this record —
   * a column alone means the answer lives somewhere only an engineer can reach.
   *
   * `performedBy` is null: nobody in this CRM did it. The column is already
   * nullable, which is what makes that expressible.
   */
  async function applyOptOut(resolved: ResolvedToken): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      const { changed } = await optOutCustomer(tx, {
        tenantId: resolved.tenantId,
        customerId: resolved.customerId,
        source: "unsubscribe_link",
      });

      if (!changed) return;

      await tx.insert(customerActivities).values({
        tenantId: resolved.tenantId,
        customerId: resolved.customerId,
        type: "customer.unsubscribed",
        description: "Customer unsubscribed from marketing email",
        metadata: { source: "unsubscribe_link" },
        performedBy: null,
      });
    });
  }

  /**
   * GET /public/unsubscribe/:token
   * Who is this link for? Changes nothing.
   */
  fastify.get(
    "/:token",
    {
      schema: { params: unsubscribeTokenParam },
      config: { rateLimit: VIEW_LIMIT },
    },
    async (request, reply) => {
      const resolved = await resolve(request.params.token);
      if (!resolved) {
        return reply.status(404).send({ message: "This unsubscribe link is not valid" });
      }

      return reply.send({
        data: {
          businessName: resolved.businessName,
          // Masked. The page has to show *something* so the reader knows which
          // address is affected, but the full address is not this endpoint's to
          // hand out — anyone holding the link can already read the page.
          email: maskEmail(resolved.email),
          alreadyOptedOut: resolved.alreadyOptedOut,
        },
      });
    },
  );

  /**
   * POST /public/unsubscribe/:token
   * The opt-out itself, from the confirmation page.
   */
  fastify.post(
    "/:token",
    {
      schema: { params: unsubscribeTokenParam },
      config: { rateLimit: ACT_LIMIT },
    },
    async (request, reply) => {
      const resolved = await resolve(request.params.token);
      if (!resolved) {
        return reply.status(404).send({ message: "This unsubscribe link is not valid" });
      }

      await applyOptOut(resolved);

      // 200 whether or not this call was the one that changed something. A
      // second click means the person wants it to stop, and it has stopped.
      return reply.send({
        data: {
          businessName: resolved.businessName,
          optedOut: true,
        },
      });
    },
  );

  /**
   * POST /public/unsubscribe/:token/one-click
   *
   * RFC 8058. The mail client posts here itself when the reader clicks the
   * unsubscribe control Gmail renders next to the sender name — no browser, no
   * page, nobody to read a response body. Gmail and Yahoo require this of bulk
   * senders, and this account sends from a **shared** domain, so a missing
   * one-click path is a deliverability problem for every tenant rather than
   * just for the one whose email it was.
   *
   * Returns 204 and nothing else. The body a client posts is
   * `List-Unsubscribe=One-Click` as form data; it carries no information the
   * token does not already, so it is neither parsed nor required.
   */
  fastify.post(
    "/:token/one-click",
    {
      schema: { params: unsubscribeTokenParam },
      config: { rateLimit: ACT_LIMIT },
    },
    async (request, reply) => {
      const resolved = await resolve(request.params.token);
      // Even a bad token gets a 204. A mail provider retries a 4xx and there is
      // nothing for it to fix; the failure that matters is the one where a valid
      // unsubscribe does not take effect.
      if (resolved) await applyOptOut(resolved);
      return reply.status(204).send();
    },
  );
};

/** `dana@example.com` → `d•••@example.com`. Enough to recognise, not to harvest. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  const first = email.slice(0, 1);
  return `${first}•••${email.slice(at)}`;
}

export default publicUnsubscribeRoutes;
