/**
 * Booking events. Subject is always the booking.
 *
 * The only domain where the subject may have **no** customer record. A public
 * portal visitor submits a name, an email and a date; the customer row is
 * matched or created by the same request, but a booking taken by phone and
 * typed in can be linked later or never. So `customerId` is nullable here and
 * nowhere else, and the contact fields come off the booking itself — which is
 * what the confirmation email has always used.
 */

import { z } from "zod";
import {
  bookingStatusSchema,
  isoDateField,
  isoDateTimeField,
  isoTimeField,
  serviceTypeSchema,
  uuidField,
} from "./shared.js";

const bookingBase = {
  bookingId: uuidField,
  customerId: uuidField.nullable(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  serviceType: serviceTypeSchema,
  bookingDate: isoDateField,
  preferredTime: isoTimeField.nullable(),
  address: z.string().nullable(),
  status: bookingStatusSchema,
};

export const bookingCreatedPayload = z
  .object({
    ...bookingBase,
    /**
     * `portal` is unauthenticated and `dashboard` is staff-entered. Worth
     * distinguishing: an auto-reply confirming "we got your request" is right
     * for the first and redundant for the second, where the customer is on the
     * phone as it is typed.
     */
    source: z.enum(["portal", "dashboard", "api"]),
    description: z.string().nullable(),
    createdAt: isoDateTimeField,
  })
  .strict();

export const bookingConfirmedPayload = z
  .object({ ...bookingBase, confirmedAt: isoDateTimeField })
  .strict();

export const bookingCancelledPayload = z
  .object({
    ...bookingBase,
    /** Free text from whoever cancelled, or null. Never interpolated into a
     *  subject line without `sanitizeSubject()`. */
    reason: z.string().nullable(),
    cancelledAt: isoDateTimeField,
  })
  .strict();

export const bookingRescheduledPayload = z
  .object({
    ...bookingBase,
    fromDate: isoDateField,
    fromTime: isoTimeField.nullable(),
    toDate: isoDateField,
    toTime: isoTimeField.nullable(),
  })
  .strict();

/**
 * The booking became a job.
 *
 * Carries both ids because the automation that fires here is nearly always
 * about the job — "the site visit is booked, tell the tech" — while the trigger
 * the tenant configured was about the booking. `convertedToJobId` is the bridge,
 * and it is on the payload rather than looked up because the conversion is the
 * one moment the link is guaranteed to be fresh.
 */
export const bookingConvertedPayload = z
  .object({
    ...bookingBase,
    jobId: uuidField,
    jobNumber: z.string(),
    convertedAt: isoDateTimeField,
  })
  .strict();
