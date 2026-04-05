import { z } from "zod";

export const calendarEventsQuery = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createCalendarEventBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  eventDate: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  color: z.string().optional(),
  customerId: z.string().uuid().optional(),
});

export const updateCalendarEventBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  eventDate: z.string().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  color: z.string().optional(),
  customerId: z.string().uuid().nullable().optional(),
});
