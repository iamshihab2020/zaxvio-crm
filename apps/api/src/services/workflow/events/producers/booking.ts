/**
 * Booking producers.
 *
 * The only domain whose subject may have no customer row. Contact details come
 * off the booking itself — which is what the confirmation email has always used
 * — so an automation can reply to a portal submission before anyone in the CRM
 * has touched it.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import { isoDate, isoDateTime, isoTime, type ProducerContext } from "./shared.js";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
type ServiceType =
  | "installation"
  | "repair"
  | "maintenance"
  | "inspection"
  | "emergency"
  | "consultation"
  | "other";

export interface BookingArgs {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceType: ServiceType;
  bookingDate: Date | string;
  preferredTime: string | null;
  address: string | null;
  status: BookingStatus;
}

interface BookingBaseFields {
  bookingId: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceType: ServiceType;
  bookingDate: string;
  preferredTime: string | null;
  address: string | null;
  status: BookingStatus;
}

function bookingBase(b: BookingArgs): BookingBaseFields {
  const date = isoDate(b.bookingDate);
  if (!date) {
    // `booking_date` is NOT NULL, so this is a producer bug rather than data.
    // Throwing here beats emitting a payload the worker will dead-letter.
    throw new Error(`Booking ${b.id} has no booking date; cannot emit an event.`);
  }
  return {
    bookingId: b.id,
    customerId: b.customerId,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: b.customerPhone,
    serviceType: b.serviceType,
    bookingDate: date,
    preferredTime: isoTime(b.preferredTime),
    address: b.address,
    status: b.status,
  };
}

export interface BookingCreatedArgs extends ProducerContext {
  booking: BookingArgs & { description: string | null; createdAt: Date | string };
  source: "portal" | "dashboard" | "api";
}

export function bookingCreated(db: EmitDb, args: BookingCreatedArgs) {
  const b = bookingBase(args.booking);
  return emitWorkflowEvent(db, {
    type: "booking.created",
    tenantId: args.tenantId,
    subject: { type: "booking", id: b.bookingId },
    actorUserId: args.actorUserId,
    payload: {
      bookingId: b.bookingId,
      customerId: b.customerId,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceType: b.serviceType,
      bookingDate: b.bookingDate,
      preferredTime: b.preferredTime,
      address: b.address,
      status: b.status,
      source: args.source,
      description: args.booking.description,
      createdAt: isoDateTime(args.booking.createdAt),
    },
  });
}

export interface BookingConfirmedArgs extends ProducerContext {
  booking: BookingArgs;
  confirmedAt: Date | string;
}

export function bookingConfirmed(db: EmitDb, args: BookingConfirmedArgs) {
  const b = bookingBase(args.booking);
  return emitWorkflowEvent(db, {
    type: "booking.confirmed",
    tenantId: args.tenantId,
    subject: { type: "booking", id: b.bookingId },
    actorUserId: args.actorUserId,
    payload: {
      bookingId: b.bookingId,
      customerId: b.customerId,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceType: b.serviceType,
      bookingDate: b.bookingDate,
      preferredTime: b.preferredTime,
      address: b.address,
      status: b.status,
      confirmedAt: isoDateTime(args.confirmedAt),
    },
  });
}

export interface BookingCancelledArgs extends ProducerContext {
  booking: BookingArgs;
  reason: string | null;
  cancelledAt: Date | string;
}

export function bookingCancelled(db: EmitDb, args: BookingCancelledArgs) {
  const b = bookingBase(args.booking);
  return emitWorkflowEvent(db, {
    type: "booking.cancelled",
    tenantId: args.tenantId,
    subject: { type: "booking", id: b.bookingId },
    actorUserId: args.actorUserId,
    payload: {
      bookingId: b.bookingId,
      customerId: b.customerId,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceType: b.serviceType,
      bookingDate: b.bookingDate,
      preferredTime: b.preferredTime,
      address: b.address,
      status: b.status,
      reason: args.reason,
      cancelledAt: isoDateTime(args.cancelledAt),
    },
  });
}

export interface BookingRescheduledArgs extends ProducerContext {
  booking: BookingArgs;
  fromDate: Date | string;
  fromTime: string | null;
}

export function bookingRescheduled(db: EmitDb, args: BookingRescheduledArgs) {
  const b = bookingBase(args.booking);
  const fromDate = isoDate(args.fromDate);
  if (!fromDate) {
    throw new Error(`Booking ${b.bookingId} was rescheduled from no date.`);
  }
  return emitWorkflowEvent(db, {
    type: "booking.rescheduled",
    tenantId: args.tenantId,
    subject: { type: "booking", id: b.bookingId },
    actorUserId: args.actorUserId,
    payload: {
      bookingId: b.bookingId,
      customerId: b.customerId,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceType: b.serviceType,
      bookingDate: b.bookingDate,
      preferredTime: b.preferredTime,
      address: b.address,
      status: b.status,
      fromDate,
      fromTime: isoTime(args.fromTime),
      toDate: b.bookingDate,
      toTime: b.preferredTime,
    },
  });
}

export interface BookingConvertedArgs extends ProducerContext {
  booking: BookingArgs;
  job: { id: string; jobNumber: string };
  convertedAt: Date | string;
}

export function bookingConverted(db: EmitDb, args: BookingConvertedArgs) {
  const b = bookingBase(args.booking);
  return emitWorkflowEvent(db, {
    type: "booking.converted",
    tenantId: args.tenantId,
    subject: { type: "booking", id: b.bookingId },
    actorUserId: args.actorUserId,
    // Conversion is guarded by a row lock and a `converted_to_job_id` check,
    // but the failure this key defends against is the one that actually
    // happened here: a `.catch()` that returned a truthy reply object, so a
    // double-click ran the success path twice and emailed the customer twice.
    dedupKey: `booking.converted:${b.bookingId}`,
    payload: {
      bookingId: b.bookingId,
      customerId: b.customerId,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceType: b.serviceType,
      bookingDate: b.bookingDate,
      preferredTime: b.preferredTime,
      address: b.address,
      status: b.status,
      jobId: args.job.id,
      jobNumber: args.job.jobNumber,
      convertedAt: isoDateTime(args.convertedAt),
    },
  });
}
