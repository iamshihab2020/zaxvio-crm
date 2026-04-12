import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  getSupabaseAdmin,
  quotes,
  quoteLineItems,
  quoteActivities,
  tenants,
  customers,
  eq,
  and,
  asc,
  lt,
} from "@hvac-saas/database";
import {
  quoteTokenParam,
  acceptQuoteBody,
  declineQuoteBody,
} from "../../lib/schemas/public-quote.js";

/** Broadcast quote status change via Supabase Realtime so the dashboard updates live. */
async function broadcastQuoteUpdate(tenantId: string, quoteId: string, status: string, quoteNumber: string | null) {
  try {
    const supabase = getSupabaseAdmin();
    const channel = supabase.channel(`quotes:${tenantId}`);
    await channel.send({
      type: "broadcast",
      event: "quote_updated",
      payload: { quoteId, status, quoteNumber },
    });
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error("[public-quote] broadcast failed:", err);
  }
}

/**
 * Resolve a quote by access token. Returns quote + tenant + customer name + settings.
 * Returns null if not found, tenant inactive, or token missing.
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
      slug: tenants.slug,
      phone: tenants.phone,
      address: tenants.address,
      city: tenants.city,
      state: tenants.state,
      zipCode: tenants.zipCode,
      timezone: tenants.timezone,
      quoteTermsConditions: tenants.quoteTermsConditions,
      quoteFooterMessage: tenants.quoteFooterMessage,
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
    .where(eq(quotes.accessToken, token))
    .then((r) => r[0] ?? null);

  if (!result || !result.tenantIsActive) return null;
  return result;
}

/**
 * Auto-expire a quote if past its expiryDate. Returns true if expired.
 */
async function autoExpireIfNeeded(
  db: ReturnType<typeof getDb>,
  quoteId: string,
  tenantId: string,
  expiryDate: string | null,
  currentStatus: string,
): Promise<boolean> {
  if (currentStatus !== "sent" || !expiryDate) return false;
  const today = new Date().toISOString().split("T")[0];
  if (expiryDate >= today) return false;

  await db
    .update(quotes)
    .set({ status: "expired" as never, updatedAt: new Date() })
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
  return true;
}

const publicQuoteRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // ===== VIEW QUOTE =====

  /**
   * GET /public/quote/:token
   * View quote details by access token. No auth required.
   */
  fastify.get(
    "/:token",
    { schema: { params: quoteTokenParam } },
    async (request, reply) => {
      const { token } = request.params;
      const result = await resolveQuoteByToken(token);

      if (!result) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      // Auto-expire if past expiryDate
      const expired = await autoExpireIfNeeded(
        getDb(),
        result.id,
        result.tenantId,
        result.expiryDate,
        result.status,
      );
      const status = expired ? "expired" : result.status;

      // Fetch line items
      const db = getDb();
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
            lineItems: lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              total: li.total,
              itemType: li.itemType,
            })),
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

  // ===== ACCEPT QUOTE =====

  /**
   * POST /public/quote/:token/accept
   * Accept a quote. No auth required — token validates access.
   */
  fastify.post(
    "/:token/accept",
    { schema: { params: quoteTokenParam, body: acceptQuoteBody } },
    async (request, reply) => {
      const { token } = request.params;
      const body = request.body ?? {};
      const db = getDb();

      const result = await resolveQuoteByToken(token);
      if (!result) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      // Auto-expire check
      const expired = await autoExpireIfNeeded(
        db,
        result.id,
        result.tenantId,
        result.expiryDate,
        result.status,
      );
      if (expired) {
        return reply.status(400).send({ message: "This quote has expired" });
      }

      if (result.status !== "sent") {
        return reply
          .status(400)
          .send({ message: "This quote has already been responded to" });
      }

      // Update quote to accepted
      await db
        .update(quotes)
        .set({
          status: "accepted" as never,
          customerScheduledDate: body.scheduledDate ?? null,
          customerScheduledTime: body.scheduledTime ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(quotes.id, result.id), eq(quotes.tenantId, result.tenantId)),
        );

      // Log activity
      const scheduleInfo = body.scheduledDate
        ? ` — preferred date: ${body.scheduledDate}${body.scheduledTime ? ` at ${body.scheduledTime}` : ""}`
        : "";
      await db.insert(quoteActivities).values({
        tenantId: result.tenantId,
        quoteId: result.id,
        type: "quote.accepted",
        description: `Quote accepted by customer online${scheduleInfo}`,
        performedBy: null,
        metadata: body.scheduledDate
          ? {
              scheduledDate: body.scheduledDate,
              scheduledTime: body.scheduledTime,
              source: "public",
            }
          : { source: "public" },
      });

      // Dispatch notification
      dispatchNotification({
        tenantId: result.tenantId,
        type: "quote_accepted",
        title: `Quote ${result.quoteNumber ?? ""} accepted online`,
        description: body.scheduledDate
          ? `Customer accepted and requested ${body.scheduledDate}${body.scheduledTime ? ` at ${body.scheduledTime}` : ""}`
          : "Customer accepted the quote online",
        entityType: "quote",
        entityId: result.id,
        actorId: null,
        metadata: { quoteNumber: result.quoteNumber, source: "public" },
      });

      // Auto-convert to job if enabled
      let jobCreated = false;
      if (result.quoteAutoConvertToJob) {
        try {
          const { convertQuoteToJob } = await import(
            "../../lib/quote-to-job.js"
          );
          await convertQuoteToJob(db, result, {
            scheduledDate: body.scheduledDate,
            scheduledTime: body.scheduledTime,
            performedBy: null,
          });
          jobCreated = true;
        } catch (err) {
          console.error("[public-quote] Auto-convert to job failed:", err);
        }
      }

      // Broadcast to dashboard for live table refresh
      await broadcastQuoteUpdate(result.tenantId, result.id, "accepted", result.quoteNumber);

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
    { schema: { params: quoteTokenParam, body: declineQuoteBody } },
    async (request, reply) => {
      const { token } = request.params;
      const body = request.body ?? {};
      const db = getDb();

      const result = await resolveQuoteByToken(token);
      if (!result) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      // Auto-expire check
      const expired = await autoExpireIfNeeded(
        db,
        result.id,
        result.tenantId,
        result.expiryDate,
        result.status,
      );
      if (expired) {
        return reply.status(400).send({ message: "This quote has expired" });
      }

      if (result.status !== "sent") {
        return reply
          .status(400)
          .send({ message: "This quote has already been responded to" });
      }

      // Update quote to declined
      await db
        .update(quotes)
        .set({
          status: "declined" as never,
          declineReason: body.reason ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(quotes.id, result.id), eq(quotes.tenantId, result.tenantId)),
        );

      // Log activity
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

      // Dispatch notification
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

      // Broadcast to dashboard for live table refresh
      broadcastQuoteUpdate(result.tenantId, result.id, "declined", result.quoteNumber);

      return reply.send({
        data: { status: "declined" },
      });
    },
  );
};

export default publicQuoteRoutes;
