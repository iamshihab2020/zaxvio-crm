import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  tenants,
  availabilitySchedules,
  scheduleOverrides,
  bookings,
  customers,
  member,
  user,
  eq,
  and,
  or,
  inArray,
  asc,
  sql,
} from "@hvac-saas/database";
import { SERVICE_TYPES } from "@hvac-saas/types";
import {
  getTenantToday,
  getTenantTomorrow,
  getMaxBookingDate,
  getDayOfWeek,
} from "../../lib/timezone.js";
import { env } from "../../lib/env.js";
import {
  bookingSlugParam,
  bookingSlugAndIdParam,
  availabilityQuery,
  slotsQuery,
  submitBookingBody,
} from "../../lib/schemas/public-booking.js";

/** Resolve a tenant by slug. Returns null if not found or inactive. */
async function resolveTenantBySlug(slug: string) {
  const db = getDb();
  return db
    .select({
      id: tenants.id,
      businessName: tenants.businessName,
      logoUrl: tenants.logoUrl,
      slug: tenants.slug,
      timezone: tenants.timezone,
    })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.isActive, true)))
    .then((r) => r[0] ?? null);
}

/**
 * Get the availability window for a specific date.
 * Returns { startTime, endTime } or null if unavailable.
 */
async function getAvailabilityWindow(
  tenantId: string,
  dateStr: string,
): Promise<{ startTime: string; endTime: string } | null> {
  const db = getDb();
  const dayOfWeek = getDayOfWeek(dateStr);

  // Check override first (takes precedence)
  const override = await db
    .select()
    .from(scheduleOverrides)
    .where(
      and(
        eq(scheduleOverrides.tenantId, tenantId),
        eq(scheduleOverrides.overrideDate, dateStr),
      ),
    )
    .then((r) => r[0]);

  if (override) {
    if (!override.isAvailable) return null;
    if (override.startTime && override.endTime) {
      return { startTime: override.startTime, endTime: override.endTime };
    }
    return null;
  }

  // Fall back to recurring schedule
  const schedule = await db
    .select()
    .from(availabilitySchedules)
    .where(
      and(
        eq(availabilitySchedules.tenantId, tenantId),
        eq(availabilitySchedules.dayOfWeek, dayOfWeek),
        eq(availabilitySchedules.isActive, true),
      ),
    )
    .then((r) => r[0]);

  if (!schedule) return null;
  return { startTime: schedule.startTime, endTime: schedule.endTime };
}

/**
 * Generate 1-hour time slot start times within a window.
 * E.g., "08:00"-"17:00" → ["08:00", "09:00", ..., "16:00"]
 */
function generateTimeSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  const [startH] = startTime.split(":").map(Number);
  const [endH] = endTime.split(":").map(Number);

  for (let h = startH; h < endH; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
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
    { schema: { params: bookingSlugParam } },
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
    { schema: { params: bookingSlugParam, querystring: availabilityQuery } },
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
      const lastOfMonth = new Date(year, monthNum, 0).toISOString().split("T")[0]; // Last day

      // Clamp to valid booking window
      const rangeStart = firstOfMonth < tomorrow ? tomorrow : firstOfMonth;
      const rangeEnd = lastOfMonth > maxDate ? maxDate : lastOfMonth;

      if (rangeStart > rangeEnd) {
        return reply.send({ data: { month, timezone: tz, availableDates: [] } });
      }

      const db = getDb();

      // Fetch recurring schedule for this tenant
      let weeklySchedule = await db
        .select()
        .from(availabilitySchedules)
        .where(
          and(
            eq(availabilitySchedules.tenantId, tenant.id),
            eq(availabilitySchedules.isActive, true),
          ),
        );

      // Lazy-seed defaults for tenants created before availability seeding was added
      if (weeklySchedule.length === 0) {
        const allSchedule = await db
          .select()
          .from(availabilitySchedules)
          .where(eq(availabilitySchedules.tenantId, tenant.id));

        if (allSchedule.length === 0) {
          // No schedule at all — seed defaults
          await db.insert(availabilitySchedules).values(
            [0, 1, 2, 3, 4, 5, 6].map((day) => ({
              tenantId: tenant.id,
              dayOfWeek: day,
              startTime: "08:00",
              endTime: "17:00",
              isActive: day >= 1 && day <= 5,
            })),
          );
          weeklySchedule = await db
            .select()
            .from(availabilitySchedules)
            .where(
              and(
                eq(availabilitySchedules.tenantId, tenant.id),
                eq(availabilitySchedules.isActive, true),
              ),
            );
        }
      }

      const activeDays = new Set(weeklySchedule.map((s) => s.dayOfWeek));

      // Fetch overrides for this date range
      const overrides = await db
        .select()
        .from(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.tenantId, tenant.id),
            sql`${scheduleOverrides.overrideDate} >= ${rangeStart}`,
            sql`${scheduleOverrides.overrideDate} <= ${rangeEnd}`,
          ),
        );

      const overrideMap = new Map(overrides.map((o) => [o.overrideDate, o]));

      // Iterate through each date in range
      const availableDates: string[] = [];
      const cursor = new Date(rangeStart + "T12:00:00Z");
      const endDate = new Date(rangeEnd + "T12:00:00Z");

      while (cursor <= endDate) {
        const dateStr = cursor.toISOString().split("T")[0];
        const override = overrideMap.get(dateStr);

        if (override) {
          // Override takes precedence
          if (override.isAvailable) {
            availableDates.push(dateStr);
          }
          // else: explicitly unavailable, skip
        } else {
          // Check recurring schedule
          const dayOfWeek = cursor.getUTCDay();
          if (activeDays.has(dayOfWeek)) {
            availableDates.push(dateStr);
          }
        }

        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return reply.send({
        data: { month, timezone: tz, availableDates },
      });
    },
  );

  /**
   * GET /public/booking/:slug/slots?date=YYYY-MM-DD
   *
   * Returns available time slots for a specific date.
   * No auth required.
   */
  fastify.get(
    "/:slug/slots",
    { schema: { params: bookingSlugParam, querystring: slotsQuery } },
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

      // Get availability window for this date
      const window = await getAvailabilityWindow(tenant.id, dateStr);
      if (!window) {
        return reply.send({ data: { date: dateStr, timezone: tz, slots: [] } });
      }

      // Generate slots
      const allSlots = generateTimeSlots(window.startTime, window.endTime);

      // Fetch existing bookings for this date
      const db = getDb();
      const existingBookings = await db
        .select({ preferredTime: bookings.preferredTime })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, tenant.id),
            eq(bookings.bookingDate, dateStr),
            inArray(bookings.status, ["pending", "confirmed"]),
          ),
        );

      const bookedTimes = new Set(
        existingBookings
          .map((b) => b.preferredTime)
          .filter(Boolean)
          // Normalize "08:00:00" to "08:00"
          .map((t) => t!.substring(0, 5)),
      );

      const slots = allSlots.map((time) => ({
        time,
        available: !bookedTimes.has(time),
      }));

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
    { schema: { params: bookingSlugParam, body: submitBookingBody } },
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

      const tomorrow = getTenantTomorrow(tz);
      const maxDate = getMaxBookingDate(tz);

      if (body.bookingDate < tomorrow) {
        return reply.status(400).send({ message: "Booking date must be at least 24 hours in the future." });
      }

      if (body.bookingDate > maxDate) {
        return reply.status(400).send({ message: "Booking date must be within 3 months." });
      }

      // Re-verify slot availability (race condition guard)
      const window = await getAvailabilityWindow(tenant.id, body.bookingDate);
      if (!window) {
        return reply.status(400).send({ message: "No availability on the selected date." });
      }

      // Check the time falls within the availability window
      if (body.preferredTime < window.startTime || body.preferredTime >= window.endTime) {
        return reply.status(400).send({ message: "Selected time is outside available hours." });
      }

      const db = getDb();
      const trimmedName = body.customerName.trim();
      const trimmedEmail = body.customerEmail?.trim() || null;
      const trimmedPhone = body.customerPhone?.trim() || null;
      const trimmedAddress = body.address?.trim() || null;

      // 1. Resolve or create customer
      let customerId: string | null = null;

      // Try matching by email first (most reliable), then by phone
      const matchConditions = [];
      if (trimmedEmail) {
        matchConditions.push(eq(customers.email, trimmedEmail));
      }
      if (trimmedPhone) {
        matchConditions.push(eq(customers.phone, trimmedPhone));
      }

      if (matchConditions.length > 0) {
        const existingCustomer = await db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenant.id),
              or(...matchConditions),
            ),
          )
          .limit(1)
          .then((r) => r[0]);

        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }

      // Create new customer if no match found
      if (!customerId) {
        const nameParts = trimmedName.split(/\s+/);
        const firstName = nameParts[0] || trimmedName;
        const lastName = nameParts.slice(1).join(" ") || "";

        const [newCustomer] = await db
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
      }

      // 2. Create booking with linked customer (double-booking guard in transaction)
      const [created] = await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.tenantId, tenant.id),
              eq(bookings.bookingDate, body.bookingDate),
              eq(bookings.preferredTime, body.preferredTime),
              inArray(bookings.status, ["pending", "confirmed"]),
            ),
          )
          .then((r) => r[0]);

        if (existing) {
          throw new Error("SLOT_TAKEN");
        }

        return tx
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
      }).catch((err) => {
        if (err.message === "SLOT_TAKEN") {
          return reply.status(409).send({
            message: "This time slot is no longer available. Please choose another.",
          });
        }
        throw err;
      });

      // If reply was already sent (409 case), created will be undefined
      if (!created) return;

      emitPlatformEvent(tenant.id, "booking_received", null);

      dispatchNotification({
        tenantId: tenant.id,
        type: "booking_received",
        title: `New booking from ${body.customerName ?? "a customer"}`,
        description: `${body.serviceType ?? "Service"} booking for ${body.bookingDate ?? ""}${body.preferredTime ? ` at ${body.preferredTime}` : ""}`,
        entityType: "booking",
        entityId: created.id,
        actorId: null,
        metadata: {
          customerName: body.customerName,
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

        // Fetch owner email (creator of the organization)
        const ownerMember = await db
          .select({ userId: member.userId })
          .from(member)
          .where(and(eq(member.organizationId, fullTenant?.organizationId ?? ""), eq(member.role, "owner")))
          .then((r) => r[0]);

        const ownerUser = ownerMember
          ? await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, ownerMember.userId)).then((r) => r[0])
          : null;

        const bookingDateStr = new Date(body.bookingDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const serviceLabel = body.serviceType.charAt(0).toUpperCase() + body.serviceType.slice(1);

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
              dashboardUrl: `${env.FRONTEND_URL}/bookings`,
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
   */
  fastify.get(
    "/:slug/status/:bookingId",
    { schema: { params: bookingSlugAndIdParam } },
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
          timezone: tenant.timezone,
        },
      });
    },
  );
};
export default publicBookingRoutes;
