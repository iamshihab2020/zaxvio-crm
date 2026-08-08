/**
 * Equipment and maintenance-contract events.
 *
 * Three of the four are **derived** — nothing writes them, a daily sweep
 * notices that a date has arrived. That is the difference between "a warranty
 * expired" and "someone edited a warranty date", and only the first is worth
 * automating on.
 */

import { z } from "zod";
import {
  customerRef,
  isoDateField,
  isoDateTimeField,
  moneyField,
  serviceFrequencySchema,
  uuidField,
} from "./shared.js";

const equipmentBase = {
  ...customerRef,
  equipmentId: uuidField,
  equipmentType: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  location: z.string().nullable(),
  installDate: isoDateField.nullable(),
  warrantyExpiry: isoDateField.nullable(),
};

export const equipmentCreatedPayload = z
  .object({ ...equipmentBase, createdAt: isoDateTimeField })
  .strict();

/**
 * P9. Fires once per equipment record per configured lead time — "60 days
 * before the warranty runs out" — never once a day for sixty days.
 *
 * `daysUntilExpiry` is on the payload so the message can say the number rather
 * than the automation having to compute a date difference in a template.
 */
export const equipmentWarrantyExpiringPayload = z
  .object({
    ...equipmentBase,
    /** Non-null by construction: an equipment record with no warranty date can
     *  never produce this event. */
    warrantyExpiryDate: isoDateField,
    daysUntilExpiry: z.number().int(),
  })
  .strict();

const contractBase = {
  ...customerRef,
  contractId: uuidField,
  contractName: z.string(),
  equipmentId: uuidField.nullable(),
  frequency: serviceFrequencySchema,
  visitsPerYear: z.number().int().min(0),
  annualPrice: moneyField.nullable(),
  startDate: isoDateField,
  endDate: isoDateField.nullable(),
};

/**
 * P9. A scheduled visit is due, computed from `frequency` + `visitsPerYear` +
 * the last completed visit — not from a stored due date, because there isn't
 * one and inventing a column would put two sources of truth on the same fact.
 */
export const contractVisitDuePayload = z
  .object({
    ...contractBase,
    dueDate: isoDateField,
    lastVisitDate: isoDateField.nullable(),
    /** Which visit of the year this is. Lets a message say "your second of four
     *  tune-ups is due" without the automation counting anything. */
    visitNumber: z.number().int().min(1),
  })
  .strict();

/** P9. N days before `end_date`, once. */
export const contractExpiringPayload = z
  .object({
    ...contractBase,
    contractEndDate: isoDateField,
    daysUntilExpiry: z.number().int(),
    /** Whether the renewal reminder email has already gone out, so an
     *  automation does not become the second thing to say the same sentence. */
    renewalReminderSent: z.boolean(),
    detectedAt: isoDateTimeField,
  })
  .strict();
