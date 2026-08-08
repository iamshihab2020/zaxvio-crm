import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  tenants,
  bookings,
  customers,
  availabilitySchedules,
  member,
  user,
  eq,
  and,
  sql,
} from "@hvac-saas/database";
import { SERVICE_TYPES } from "@hvac-saas/types";
import {
  getTenantTomorrow,
  getMaxBookingDate,
} from "../../lib/timezone.js";
import {
  checkSlotBookable,
  getAvailabilityWindows,
  getSlotsForDate,
  seedDefaultAvailability,
} from "../../services/availability.service.js";
import { env } from "../../lib/env.js";
import {
  bookingSlugParam,
  bookingSlugAndIdParam,
  availabilityQuery,
  slotsQuery,
  submitBookingBody,
} from "../../lib/schemas/public-booking.js";
import { emitBookingCreatedEvent } from "../../services/bookings/booking-events.service.js";
import { emitCustomerCreatedEvent } from "../../services/customers/customer-events.service.js";

/**
 * Rate limits for the unauthenticated surface ([[security-rules]] §4).
 *
 * The global limit is 100/min/IP. These endpoints are reached through Next.js
 * server actions, so Fastify sees the *Next server's* IP for every visitor —
 * the budget is shared between the booking portal, the dashboard and every
 * authenticated user. `submit` is the one that writes rows, creates customers
 * and sends two emails, and until now it had no route limit at all.
 */
const READ_LIMIT = { max: 60, timeWindow: "1 minute" } as const;
const SUBMIT_LIMIT = { max: 5, timeWindow: "1 minute" } as const;
const STATUS_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

/** Resolve a tenant by slug. Returns null if not found or inactive. */
async function resolveTenantBySlug(slug: string) {
  const db = getDb();
  return db
    .select({
      id: tenants.id,
      businessName: tenants.businessName,
      logoUrl: tenants.logoUrl,
      // The portal printed a hardcoded "Licensed & Insured" badge for every
      // tenant. The column has always existed; the badge never read it.
      licenseNumber: tenants.licenseNumber,
      slug: tenants.slug,
      timezone: tenants.timezone,
      bookingSlotCapacity: tenants.bookingSlotCapacity,
    })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.isActive, true)))
    .then((r) => r[0] ?? null);
}

const publicBookingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /public/booking/:slug
   *
   * Returns tenant branding + available service types.
   * No auth required.
   */
  fastify.get(
    "/:slug",
    { schema: { params: bookingSlugParam }, config: { rateLimit: READ_LIMIT } },
    async (request, reply) => {
      const { slug } = request.params;
      const tenant = await resolveTenantBySlug(slug);

      if (!tenant) {
        return reply.status(404).send({ message: "Business not found" });
      }

      return reply.send({
        data: {
          businessName: tenant.businessName,
          logoUrl: tenant.logoUrl,
          licenseNumber: tenant.licenseNumber,
          slug: tenant.slug,
          timezone: tenant.timezone,
          serviceTypes: [...SERVICE_TYPES],
        },
      });
    },
  );

  /**
   * GET /public/booking/:slug/availability?month=YYYY-MM
   *
   * Returns available dates for a given month.
   * No auth required.
   */
  fastify.get(
    "/:slug/availability",
    {
      schema: { params: bookingSlugParam, querystring: availabilityQuery },
      config: { rateLimit: READ_LIMIT },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { month } = request.query;

      const tenant = await resolveTenantBySlug(slug);
      if (!tenant) {
        return reply.status(404).send({ message: "Business not found" });
      }

      const tz = tenant.timezone ?? "America/Chicago";
      const tomorrow = getTenantTomorrow(tz);
      const maxDate = getMaxBookingDate(tz);

      // Calculate date range for the month
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const firstOfMonth = `${month}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const lastOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

      // Clamp to valid booking window
      const rangeStart = firstOfMonth < tomorrow ? tomorrow : firstOfMonth;
      const rangeEnd = lastOfMonth > maxDate ? maxDate : lastOfMonth;

      if (rangeStart > rangeEnd) {
        return reply.send({ data: { month, timezone: tz, availableDates: [] } });
      }

      const db = getDb();

      // Lazy-seed defaults for tenants created before availability seeding existed.
      const existingSchedule = await db
        .select({ id: availabilitySchedules.id })
        .from(availabilitySchedules)
        .where(eq(availabilitySchedules.tenantId, tenant.id))
        .limit(1);
      if (existingSchedule.length === 0) {
        await seedDefaultAvailability(db, tenant.id);
      }

      const windows = await getAvailabilityWindows(db, tenant.id, rangeStart, rangeEnd);

      return reply.send({
        data: { month, timezone: tz, availableDates: [...windows.keys()].sort() },
      });
    },
  );

  /**
   * GET /public/booking/:slug/slots?date=YYYY-MM-DD
   *
   * Returns available time slots for a specific date.
   *
   * Slots are blocked by bookings, jobs *and* calendar events. Blocking only on
   * bookings meant a day filled from phone calls still showed nine slots for
   * sale — the portal's entire purpose is to stop that (BOOK-21).
   */
  fastify.get(
    "/:slug/slots",
    {
      schema: { params: bookingSlugParam, querystring: slotsQuery },
      config: { rateLimit: READ_LIMIT },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { date: dateStr } = request.query;

      const tenant = await resolveTenantBySlug(slug);
      if (!tenant) {
        return reply.status(404).send({ message: "Business not found" });
      }

      const tz = tenant.timezone ?? "America/Chicago";
      const tomorrow = getTenantTomorrow(tz);
      const maxDate = getMaxBookingDate(tz);

      if (dateStr < tomorrow) {
        return reply.status(400).send({ message: "Booking date must be at least 24 hours in the future." });
      }

      if (dateStr > maxDate) {
        return reply.status(400).send({ message: "Booking date must be within 3 months." });
      }

      const db = getDb();
      const slots = await getSlotsForDate(
        db,
        tenant.id,
        dateStr,
        tenant.bookingSlotCapacity ?? 1,
      );

      return reply.send({ data: { date: dateStr, timezone: tz, slots } });
    },
  );

  /**
   * POST /public/booking/:slug/submit
   *
   * Create a new pending booking.
   * No auth required.
   */
  fastify.post(
    "/:slug/submit",
    {
      schema: { params: bookingSlugParam, body: submitBookingBody },
      config: { rateLimit: SUBMIT_LIMIT },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const body = request.body;

      const tenant = await resolveTenantBySlug(slug);
      if (!tenant) {
        return reply.status(404).send({ message: "Business not found" });
      }

      const tz = tenant.timezone ?? "America/Chicago";

      // At least one contact method required (Zod only validates formats, not this cross-field rule)
      if (!body.customerPhone && !body.customerEmail) {
        return reply.status(400).send({ message: "Phone or email is required." });
      }

      const db = getDb();

      // Every availability rule, resolved in one place shared with the dashboard.
      const bookable = await checkSlotBookable(db, {
        tenantId: tenant.id,
        timezone: tz,
        dateStr: body.bookingDate,
        time: body.preferredTime,
        capacity: tenant.bookingSlotCapacity ?? 1,
        minDate: getTenantTomorrow(tz),
        maxDate: getMaxBookingDate(tz),
      });
      if (!bookable.ok) {
        return reply.status(400).send({ message: bookable.message });
      }

      const trimmedName = body.customerName.trim();
      const trimmedEmail = body.customerEmail?.trim() || null;
      const trimmedPhone = body.customerPhone?.trim() || null;
      const trimmedAddress = body.address?.trim() || null;

      // Customer lookup + booking creation in a single transaction to prevent
      // duplicate customers from concurrent submissions (DF-BK-07).
      //
      // The transaction result is NOT destructured or truthiness-checked here.
      // It used to be `const [created] = await db.transaction(...).catch(...)`,
      // and the catch returned `reply.status(409).send(...)` — a reply object,
      // which is not iterable, so every double-booking race threw a TypeError
      // into the error handler *after* the 409 had already gone out (BOOK-05).
      let created: typeof bookings.$inferSelect | null = null;
      try {
        const rows = await db.transaction(async (tx) => {
          // 1. Resolve or create customer
          // Sequential lookup: email first, then phone fallback (DF-BK-06)
          let customerId: string | null = null;

          if (trimmedEmail) {
            const byEmail = await tx
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenant.id),
                  eq(sql`lower(${customers.email})`, trimmedEmail.toLowerCase()),
                ),
              )
              .limit(1)
              .then((r) => r[0]);
            if (byEmail) customerId = byEmail.id;
          }

          if (!customerId && trimmedPhone) {
            const byPhone = await tx
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenant.id),
                  eq(customers.phone, trimmedPhone),
                ),
              )
              .limit(1)
              .then((r) => r[0]);
            if (byPhone) customerId = byPhone.id;
          }

          // Create new customer if no match found
          let customerIsNew = false;
          if (!customerId) {
            const nameParts = trimmedName.split(/\s+/);
            const firstName = nameParts[0] || trimmedName;
            const lastName = nameParts.slice(1).join(" ") || "";

            const [newCustomer] = await tx
              .insert(customers)
              .values({
                tenantId: tenant.id,
                firstName,
                lastName,
                email: trimmedEmail,
                phone: trimmedPhone,
                address: trimmedAddress,
              })
              .returning();

            customerId = newCustomer.id;
            customerIsNew = true;
          }

          // 2. Double-booking guard, re-checked inside the transaction.
          const taken = await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(
              and(
                eq(bookings.tenantId, tenant.id),
                eq(bookings.bookingDate, body.bookingDate),
                eq(bookings.preferredTime, body.preferredTime),
                sql`${bookings.status} IN ('pending','confirmed')`,
                sql`${bookings.archivedAt} IS NULL`,
              ),
            );

          if (taken.length >= (tenant.bookingSlotCapacity ?? 1)) {
            throw new Error("SLOT_TAKEN");
          }

          const inserted = await tx
            .insert(bookings)
            .values({
              tenantId: tenant.id,
              customerId,
              customerName: trimmedName,
              customerEmail: trimmedEmail,
              customerPhone: trimmedPhone,
              serviceType: body.serviceType,
              bookingDate: body.bookingDate,
              preferredTime: body.preferredTime,
              address: trimmedAddress,
              description: body.description?.trim() || null,
              status: "pending",
              source: body.source ?? "portal",
              quoteId: body.quoteId ?? null,
            })
            .returning();

          // Events, in the same transaction as the rows they describe. This is
          // the reason the outbox exists rather than a direct call: a portal
          // submission that failed the double-booking re-check must not leave a
          // workflow enrolled for a booking that was never made, and the visitor
          // must not wait on an automation to get their 201.
          //
          // `actorUserId` is null throughout — a portal visitor is not a user of
          // this CRM, and stamping one would put a fabricated name on the run's
          // audit trail.
          if (customerIsNew && customerId) {
            await emitCustomerCreatedEvent(tx, {
              tenantId: tenant.id,
              actorUserId: null,
              customerId,
              source: "booking",
            });
          }

          if (inserted[0]) {
            await emitBookingCreatedEvent(tx, {
              tenantId: tenant.id,
              actorUserId: null,
              bookingId: inserted[0].id,
              // `body.source` also feeds `bookings.source`, which is free text
              // and accepts anything. The event's `source` is a closed set, so
              // anything that is not a recognised channel is reported as the
              // portal it in fact came through.
              source: body.source === "api" ? "api" : "portal",
            });
          }

          return inserted;
        });
        created = rows[0] ?? null;
      } catch (err) {
        if (err instanceof Error && err.message === "SLOT_TAKEN") {
          return reply.status(409).send({
            message: "This time slot is no longer available. Please choose another.",
          });
        }
        throw err;
      }

      if (!created) {
        request.log.error("Booking insert returned no row");
        return reply.status(500).send({ message: "Failed to create booking" });
      }

      emitPlatformEvent(tenant.id, "booking_received", null);

      dispatchNotification({
        tenantId: tenant.id,
        type: "booking_received",
        title: `New booking from ${trimmedName}`,
        description: `${body.serviceType} booking for ${body.bookingDate} at ${body.preferredTime}`,
        entityType: "booking",
        entityId: created.id,
        actorId: null,
        metadata: {
          customerName: trimmedName,
          serviceType: body.serviceType,
          bookingDate: body.bookingDate,
          preferredTime: body.preferredTime,
        },
      });

      // E-02 + E-03: Booking confirmation emails (fire-and-forget)
      {
        const { sendBookingConfirmationEmail, sendNewBookingNotificationEmail } = await import("../../lib/email.js");

        // Fetch full tenant info for emails (phone, address, owner email)
        const fullTenant = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenant.id))
          .then((r) => r[0]);

        // Fetch owner email (creator of the organization).
        // A tenant with no organizationId used to match nothing here and the
        // owner was silently never emailed — now it says so in the log (BOOK-32).
        const organizationId = fullTenant?.organizationId ?? null;
        const ownerMember = organizationId
          ? await db
              .select({ userId: member.userId })
              .from(member)
              .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
              .then((r) => r[0])
          : null;

        if (!organizationId) {
          request.log.warn(
            { tenantId: tenant.id },
            "E-03 skipped: tenant has no organizationId, cannot resolve owner",
          );
        } else if (!ownerMember) {
          request.log.warn(
            { tenantId: tenant.id, organizationId },
            "E-03 skipped: organization has no owner member",
          );
        }

        const ownerUser = ownerMember
          ? await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, ownerMember.userId)).then((r) => r[0])
          : null;

        const bookingDateStr = new Date(body.bookingDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
        const serviceLabel = body.serviceType.charAt(0).toUpperCase() + body.serviceType.slice(1);
        const statusUrl = `${env.FRONTEND_URL}/book/${tenant.slug}/status/${created.id}`;

        // E-02: Customer booking confirmation
        if (trimmedEmail) {
          sendBookingConfirmationEmail({
            to: trimmedEmail,
            props: {
              customerName: trimmedName,
              businessName: tenant.businessName ?? "Service Business",
              businessLogoUrl: tenant.logoUrl ?? null,
              businessPhone: fullTenant?.phone ?? null,
              businessAddress: fullTenant?.address ?? null,
              serviceType: serviceLabel,
              bookingDate: bookingDateStr,
              preferredTime: body.preferredTime,
              address: trimmedAddress,
              notes: body.description?.trim() || null,
              statusUrl,
            },
          }).catch((err) => console.error("[email] E-02 booking confirmation failed:", err));
        }

        // E-03: Owner notification
        if (ownerUser?.email) {
          sendNewBookingNotificationEmail({
            to: ownerUser.email,
            props: {
              ownerName: ownerUser.name ?? "Owner",
              customerName: trimmedName,
              customerEmail: trimmedEmail,
              customerPhone: trimmedPhone,
              serviceType: serviceLabel,
              bookingDate: bookingDateStr,
              preferredTime: body.preferredTime,
              address: trimmedAddress,
              description: body.description?.trim() || null,
              dashboardUrl: `${env.FRONTEND_URL}/bookings?bookingId=${created.id}`,
            },
          }).catch((err) => console.error("[email] E-03 new booking notification failed:", err));
        }
      }

      return reply.status(201).send({
        data: {
          id: created.id,
          bookingDate: created.bookingDate,
          preferredTime: created.preferredTime,
          serviceType: created.serviceType,
          status: created.status,
        },
      });
    },
  );

  /**
   * GET /public/booking/:slug/status/:bookingId
   *
   * Public booking status page — customer can check if their booking is confirmed.
   * No auth required.
   *
   * Threat model (BOOK-33): this returns the customer's own name and service
   * address to anyone holding the booking UUID. That is the same trade every
   * "track your order" link makes. It is acceptable because the id is a v4 UUID
   * (122 bits of entropy, not enumerable), the route is rate-limited to 10/min,
   * the id must be a well-formed UUID before the handler runs, and the response
   * carries no contact details beyond what the requester already submitted.
   * If that link is ever emailed to a third party, treat it as a capability.
   */
  fastify.get(
    "/:slug/status/:bookingId",
    {
      schema: { params: bookingSlugAndIdParam },
      config: { rateLimit: STATUS_LIMIT },
    },
    async (request, reply) => {
      const { slug, bookingId } = request.params;

      const tenant = await resolveTenantBySlug(slug);
      if (!tenant) {
        return reply.status(404).send({ message: "Business not found" });
      }

      const db = getDb();
      const booking = await db
        .select({
          id: bookings.id,
          customerName: bookings.customerName,
          serviceType: bookings.serviceType,
          bookingDate: bookings.bookingDate,
          preferredTime: bookings.preferredTime,
          address: bookings.address,
          status: bookings.status,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.tenantId, tenant.id),
          ),
        )
        .then((r) => r[0]);

      if (!booking) {
        return reply.status(404).send({ message: "Booking not found" });
      }

      return reply.send({
        data: {
          booking,
          businessName: tenant.businessName,
          logoUrl: tenant.logoUrl,
          licenseNumber: tenant.licenseNumber,
          timezone: tenant.timezone,
        },
      });
    },
  );
};
export default publicBookingRoutes;
