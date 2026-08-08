/** Customer events. Subject is always the customer. */

import { z } from "zod";
import {
  changedFieldsField,
  customerRef,
  isoDateTimeField,
  uuidField,
} from "./shared.js";

export const customerCreatedPayload = z
  .object({
    ...customerRef,
    /**
     * Where the record came from. The public booking portal creates customers
     * without anyone in the CRM touching anything, and "welcome the ones who
     * booked themselves in, not the ones I typed in" is the first automation a
     * tenant will want.
     */
    source: z.enum(["manual", "booking", "quote", "import", "api"]),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zipCode: z.string().nullable(),
    createdAt: isoDateTimeField,
  })
  .strict();

export const customerUpdatedPayload = z
  .object({
    ...customerRef,
    changedFields: changedFieldsField,
  })
  .strict();

const tagChange = z
  .object({
    ...customerRef,
    tagId: uuidField,
    /** The label, so a filter reads "VIP" instead of a uuid nobody can verify. */
    tagName: z.string(),
  })
  .strict();

export const customerTagAddedPayload = tagChange;
export const customerTagRemovedPayload = tagChange;
