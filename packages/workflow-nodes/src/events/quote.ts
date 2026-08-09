/** Quote events. Subject is always the quote. */

import { z } from "zod";
import {
  customerRef,
  isoDateField,
  isoDateTimeField,
  moneyField,
  quoteStatusSchema,
  uuidField,
} from "./shared.js";

const quoteBase = {
  ...customerRef,
  quoteId: uuidField,
  quoteNumber: z.string(),
  status: quoteStatusSchema,
  totalAmount: moneyField,
  subtotal: moneyField,
  issuedDate: isoDateField.nullable(),
  expiryDate: isoDateField.nullable(),
};

export const quoteCreatedPayload = z
  .object({ ...quoteBase, lineItemCount: z.number().int().min(0), createdAt: isoDateTimeField })
  .strict();

/**
 * Emitted **after** the access token and the PDF exist, never before.
 *
 * A `draft → sent` transition that skips those leaves a quote the portal cannot
 * open and that `/send`, `PATCH` and `DELETE` all then refuse — unusable and
 * undeletable (QUO-01). An automation firing on a half-sent quote would email a
 * link to a page that 404s, which is why the emit sits at the end of the send
 * path rather than next to the status write.
 */
export const quoteSentPayload = z
  .object({
    ...quoteBase,
    /** Whether the customer can accept online. `quoteOnlineAcceptanceEnabled`
     *  is a tenant switch, and a follow-up that says "click to accept" is wrong
     *  when it is off. */
    onlineAcceptanceEnabled: z.boolean(),
    sentAt: isoDateTimeField,
  })
  .strict();

/**
 * From inside the `SELECT … FOR UPDATE` that claims the response, so an accept
 * racing a decline produces exactly one of these two events, matching the one
 * outcome that was actually recorded.
 */
export const quoteAcceptedPayload = z
  .object({
    ...quoteBase,
    acceptedAt: isoDateTimeField,
    /** The portal's optional scheduling step. Null when the customer accepted
     *  without picking a date. */
    requestedDate: isoDateField.nullable(),
    requestedTime: z.string().nullable(),
    /** Set only when acceptance auto-converted to a job. */
    convertedToJobId: uuidField.nullable(),
  })
  .strict();

export const quoteDeclinedPayload = z
  .object({
    ...quoteBase,
    reason: z.string().nullable(),
    declinedAt: isoDateTimeField,
  })
  .strict();

/**
 * From the hourly expiry sweep, not from a read.
 *
 * Expiry is *derived* in tenant time and swept, rather than `UPDATE`d whenever
 * someone happens to open the quote (QUO-10). So this fires once, at roughly
 * the right hour, for every expired quote — including the ones nobody looked at,
 * which are precisely the ones worth chasing.
 */
export const quoteExpiredPayload = z
  .object({ ...quoteBase, expiredAt: isoDateTimeField })
  .strict();
