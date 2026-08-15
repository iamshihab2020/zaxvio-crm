import { recordQuoteView } from "../../services/quotes/quote-views.service.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { dispatchNotification } from "../../lib/notifications.js";
import { publish } from "../../lib/event-bus.js";
import {
  getDb,
  quotes,
  quoteLineItems,
  quoteActivities,
  tenants,
  customers,
  eq,
  and,
  asc,
  isNull,
} from "@hvac-saas/database";
import {
  quoteTokenParam,
  acceptQuoteBody,
  declineQuoteBody,
} from "../../lib/schemas/public-quote.js";
import { displayStatus } from "../../services/quotes/quotes.service.js";
import { emitQuoteResponseEvent } from "../../services/quotes/quote-events.service.js";
import { todayInTimezone } from "../../lib/timezone.js";

/**
 * Rate limits, same shape and reasoning as `routes/public/booking.ts`.
 *
 * These three endpoints had **none** (QUO-12). They inherited the global
 * 100/min bucket, so this was throttling rather than its absence — but the two
 * unauthenticated *mutations* in the product sat at the same limit as a
 * dashboard page load, and the tightening pass that produced booking's limits
 * walked straight past this file. [[security-rules]] §4.
 */
const READ_LIMIT = { max: 60, timeWindow: "1 minute" } as const;
const RESPOND_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

/** Broadcast quote status change over SSE so the dashboard updates live. */
function broadcastQuoteUpdate(
  tenantId: string,
  quoteId: string,
  status: string,
  quoteNumber: string | null,
) {
  try {
    publish(tenantId, "quotes", "quote_updated", { quoteId, status, quoteNumber });
  } catch (err) {
    console.error("[public-quote] broadcast failed:", err);
  }
}

/**
 * Resolve a quote by access token.
 *
 * Returns null when the token is unknown, the tenant is inactive, the tenant has
 * turned online acceptance off, or the quote has been archived.
 *
 * The `quoteOnlineAcceptanceEnabled` check is QUO-04. That flag was consulted in
 * exactly one place in the codebase — deciding whether the E-13 email carried a
 * link — while these three routes never looked at it. Turning the toggle off
 * stopped new links being *sent* and left every previously issued link fully
 * live, which is the opposite of what the settings page says it does (it
 * force-disables the two dependent toggles at the same time).
 *
 * The `archivedAt` check is QUO-23: archiving is the tenant's "make this go
 * away" action and it did not stop the portal serving the quote or accepting a
 * response to it.
 */
async function resolveQuoteByToken(token: string) {
  const db = getDb();
  const result = await db
    .select({
      id: quotes.id,
      tenantId: quotes.tenantId,
      customerId: quotes.customerId,
      quoteNumber: quotes.quoteNumber,
      status: quotes.status,
      issuedDate: quotes.issuedDate,
      expiryDate: quotes.expiryDate,
      subtotal: quotes.subtotal,
      taxRate: quotes.taxRate,
      taxAmount: quotes.taxAmount,
      discountAmount: quotes.discountAmount,
      totalAmount: quotes.totalAmount,
      notes: quotes.notes,
      equipmentId: quotes.equipmentId,
      convertedToJobId: quotes.convertedToJobId,
      declineReason: quotes.declineReason,
      customerScheduledDate: quotes.customerScheduledDate,
      customerScheduledTime: quotes.customerScheduledTime,
      // Tenant fields
      businessName: tenants.businessName,
      logoUrl: tenants.logoUrl,
      // The portal printed a hardcoded "Licensed & Insured" badge on every
      // tenant's estimate. The column has always existed; the badge just never
      // read it. Now the claim is only made when there is a number behind it.
      licenseNumber: tenants.licenseNumber,
      slug: tenants.slug,
      phone: tenants.phone,
      address: tenants.address,
      city: tenants.city,
      state: tenants.state,
      zipCode: tenants.zipCode,
      timezone: tenants.timezone,
      quoteTermsConditions: tenants.quoteTermsConditions,
      quoteFooterMessage: tenants.quoteFooterMessage,
      quoteOnlineAcceptanceEnabled: tenants.quoteOnlineAcceptanceEnabled,
      quotePostAcceptanceScheduling: tenants.quotePostAcceptanceScheduling,
      quoteAutoConvertToJob: tenants.quoteAutoConvertToJob,
      tenantIsActive: tenants.isActive,
      // Customer details
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      customerAddress: customers.address,
    })
    .from(quotes)
    .innerJoin(tenants, eq(tenants.id, quotes.tenantId))
    .innerJoin(customers, eq(customers.id, quotes.customerId))
    .where(and(eq(quotes.accessToken, token), isNull(quotes.archivedAt)))
    .then((r) => r[0] ?? null);

  if (!result) return null;
  if (!result.tenantIsActive) return null;
  if (result.quoteOnlineAcceptanceEnabled === false) return null;
  return result;
}

const publicQuoteRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // ===== VIEW QUOTE =====

  /**
   * GET /public/quote/:token
   * View quote details by access token. No auth required.
   */
  fastify.get(
    "/:token",
    { schema: { params: quoteTokenParam }, config: { rateLimit: READ_LIMIT } },
    async (request, reply) => {
      const { token } = request.params;
      const result = await resolveQuoteByToken(token);

      if (!result) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      // Derived, not written. This used to UPDATE the row on a GET — and in
      // **UTC**, so for a Chicago tenant a quote valid until today already read
      // as expired from 7pm the evening before (QUO-09, verified). The cron
      // sweep owns the write; reads just show the truth.
      const tz = result.timezone ?? "America/Chicago";
      const status = displayStatus(result, todayInTimezone(tz));

      const db = getDb();

      // The one write this GET is allowed to make, and it earns the exception:
      // it happens at most **once per quote ever**, and it records a fact about
      // the read itself that nothing else can observe. Fire-and-forget — a
      // customer trying to look at their quote must never get a 500 because a
      // timestamp could not be stamped.
      void recordQuoteView(db, {
        tenantId: result.tenantId,
        quoteId: result.id,
      }).catch((err) => {
        request.log.warn({ err, quoteId: result.id }, "quote view not recorded");
      });
      const lineItems = await db
        .select({
          description: quoteLineItems.description,
          quantity: quoteLineItems.quantity,
          unitPrice: quoteLineItems.unitPrice,
          total: quoteLineItems.total,
          itemType: quoteLineItems.itemType,
        })
        .from(quoteLineItems)
        .where(
          and(
            eq(quoteLineItems.tenantId, result.tenantId),
            eq(quoteLineItems.quoteId, result.id),
          ),
        )
        .orderBy(asc(quoteLineItems.sortOrder));

      return reply.send({
        data: {
          // Tenant branding
          business: {
            name: result.businessName,
            logoUrl: result.logoUrl,
            licenseNumber: result.licenseNumber,
            phone: result.phone,
            address: result.address,
            city: result.city,
            state: result.state,
            zipCode: result.zipCode,
            slug: result.slug,
            timezone: result.timezone,
          },
          // Quote details
          quote: {
            id: result.id,
            quoteNumber: result.quoteNumber,
            status,
            issuedDate: result.issuedDate,
            expiryDate: result.expiryDate,
            lineItems,
            subtotal: result.subtotal,
            taxAmount: result.taxAmount,
            discountAmount: result.discountAmount,
            totalAmount: result.totalAmount,
            notes: result.notes,
            termsConditions: result.quoteTermsConditions,
            footerMessage: result.quoteFooterMessage,
            customerName: `${result.customerFirstName} ${result.customerLastName}`.trim(),
            customerEmail: result.customerEmail,
            customerPhone: result.customerPhone,
            customerAddress: result.customerAddress,
            declineReason: result.declineReason,
            customerScheduledDate: result.customerScheduledDate,
            customerScheduledTime: result.customerScheduledTime,
          },
          // Settings
          settings: {
            postAcceptanceScheduling: result.quotePostAcceptanceScheduling ?? false,
            autoConvertToJob: result.quoteAutoConvertToJob ?? false,
          },
        },
      });
    },
  );

  /**
   * Claim a `sent` quote for a response, under a row lock.
   *
   * QUO-03. Accept and decline were both resolve → `if (status !== "sent")` →
   * update, with no transaction and no lock, so two requests could both pass the
   * check. A double-click produced two activity rows, two notifications and two
   * `convertQuoteToJob` calls; worse, an accept racing a decline left the quote
   * `declined` **and** a real scheduled job created by the accept path, with
   * nothing to reconcile them.
   *
   * The claim re-reads the status inside the lock and writes the terminal status
   * in the same transaction, so exactly one of N concurrent responses wins and
   * the losers get the "already responded" 400. Returns the row as it was *at*
   * the moment of the claim.
   */
  async function claimQuoteResponse(
    quoteId: string,
    tenantId: string,
    timezone: string,
    apply: { status: "accepted" | "declined"; declineReason?: string | null; scheduledDate?: string | null; scheduledTime?: string | null },
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          id: quotes.id,
          status: quotes.status,
          expiryDate: quotes.expiryDate,
        })
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
        .for("update");

      if (!locked) return { ok: false as const, message: "Quote not found" };

      if (displayStatus(locked, todayInTimezone(timezone)) === "expired") {
        return { ok: false as const, message: "This quote has expired" };
      }
      if (locked.status !== "sent") {
        return {
          ok: false as const,
          message: "This quote has already been responded to",
        };
      }

      await tx
        .update(quotes)
        .set({
          status: apply.status,
          declineReason: apply.declineReason ?? null,
          customerScheduledDate: apply.scheduledDate ?? null,
          customerScheduledTime: apply.scheduledTime ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

      // Inside the claim, deliberately. Only the request that won the lock
      // reaches this line, so an accept racing a decline emits exactly one
      // event — and it is the one that matches the status now on the row. Emit
      // it from the route instead and both racers would emit, because both
      // reach their own `if (!claim.ok)` only after this transaction commits.
      //
      // `actorUserId` is null: the customer is not a user of this CRM.
      await emitQuoteResponseEvent(tx, {
        tenantId,
        actorUserId: null,
        quoteId,
        response: apply.status,
        reason: apply.declineReason ?? null,
        requestedDate: apply.scheduledDate ?? null,
        requestedTime: apply.scheduledTime ?? null,
        // Auto-conversion runs after the claim commits, so there is genuinely
        // no job id yet. Reporting null is honest; a workflow that needs the
        // job waits on `job.created` with `origin: "quote"`.
        convertedToJobId: null,
      });

      return { ok: true as const };
    });
  }

  // ===== ACCEPT QUOTE =====

  /**
   * POST /public/quote/:token/accept
   * Accept a quote. No auth required — token validates access.
   */
  fastify.post(
    "/:token/accept",
    {
      schema: { params: quoteTokenParam, body: acceptQuoteBody },
      config: { rateLimit: RESPOND_LIMIT },
    },
    async (request, reply) => {
      const { token } = request.params;
      const body = request.body ?? {};
      const db = getDb();

      const result = await resolveQuoteByToken(token);
      if (!result) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      const tz = result.timezone ?? "America/Chicago";

      // The customer may only propose a date when the tenant has turned
      // post-acceptance scheduling on. The API used to accept and store one
      // regardless of the setting.
      const wantsSchedule = result.quotePostAcceptanceScheduling === true;
      const scheduledDate = wantsSchedule ? (body.scheduledDate ?? null) : null;
      const scheduledTime = wantsSchedule ? (body.scheduledTime ?? null) : null;

      const claim = await claimQuoteResponse(result.id, result.tenantId, tz, {
        status: "accepted",
        scheduledDate,
        scheduledTime,
      });
      if (!claim.ok) {
        return reply.status(400).send({ message: claim.message });
      }

      const scheduleInfo = scheduledDate
        ? ` — preferred date: ${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ""}`
        : "";
      await db.insert(quoteActivities).values({
        tenantId: result.tenantId,
        quoteId: result.id,
        type: "quote.accepted",
        description: `Quote accepted by customer online${scheduleInfo}`,
        performedBy: null,
        metadata: scheduledDate
          ? { scheduledDate, scheduledTime, source: "public" }
          : { source: "public" },
      });

      dispatchNotification({
        tenantId: result.tenantId,
        type: "quote_accepted",
        title: `Quote ${result.quoteNumber ?? ""} accepted online`,
        description: scheduledDate
          ? `Customer accepted and requested ${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ""}`
          : "Customer accepted the quote online",
        entityType: "quote",
        entityId: result.id,
        actorId: null,
        metadata: { quoteNumber: result.quoteNumber, source: "public" },
      });

      // Auto-convert to job if enabled. Only reachable by the request that won
      // the claim, so this can no longer run twice for one quote.
      let jobCreated = false;
      if (result.quoteAutoConvertToJob) {
        try {
          const { convertQuoteToJob } = await import(
            "../../lib/quote-to-job.js"
          );
          await convertQuoteToJob(db, { ...result, status: "accepted" }, {
            scheduledDate: scheduledDate ?? undefined,
            scheduledTime: scheduledTime ?? undefined,
            performedBy: null,
          });
          jobCreated = true;
        } catch (err) {
          console.error("[public-quote] Auto-convert to job failed:", err);
        }
      }

      broadcastQuoteUpdate(result.tenantId, result.id, "accepted", result.quoteNumber);

      return reply.send({
        data: { status: "accepted", jobCreated },
      });
    },
  );

  // ===== DECLINE QUOTE =====

  /**
   * POST /public/quote/:token/decline
   * Decline a quote with optional reason. No auth required.
   */
  fastify.post(
    "/:token/decline",
    {
      schema: { params: quoteTokenParam, body: declineQuoteBody },
      config: { rateLimit: RESPOND_LIMIT },
    },
    async (request, reply) => {
      const { token } = request.params;
      const body = request.body ?? {};
      const db = getDb();

      const result = await resolveQuoteByToken(token);
      if (!result) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      const tz = result.timezone ?? "America/Chicago";
      const claim = await claimQuoteResponse(result.id, result.tenantId, tz, {
        status: "declined",
        declineReason: body.reason ?? null,
      });
      if (!claim.ok) {
        return reply.status(400).send({ message: claim.message });
      }

      const reasonNote = body.reason ? ` — reason: "${body.reason}"` : "";
      await db.insert(quoteActivities).values({
        tenantId: result.tenantId,
        quoteId: result.id,
        type: "quote.declined",
        description: `Quote declined by customer online${reasonNote}`,
        performedBy: null,
        metadata: {
          reason: body.reason ?? null,
          source: "public",
        },
      });

      dispatchNotification({
        tenantId: result.tenantId,
        type: "quote_declined",
        title: `Quote ${result.quoteNumber ?? ""} declined online`,
        description: body.reason
          ? `Customer declined: "${body.reason}"`
          : "Customer declined the quote online",
        entityType: "quote",
        entityId: result.id,
        actorId: null,
        metadata: {
          quoteNumber: result.quoteNumber,
          reason: body.reason,
          source: "public",
        },
      });

      broadcastQuoteUpdate(result.tenantId, result.id, "declined", result.quoteNumber);

      return reply.send({
        data: { status: "declined" },
      });
    },
  );
};

export default publicQuoteRoutes;
