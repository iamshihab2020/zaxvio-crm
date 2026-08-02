import type { QuoteFormData } from "@/components/dashboard/quotes/quote-create-dialog";

/**
 * Turn the quote dialog's form state into the body `POST /quotes` accepts.
 *
 * The two shapes disagree in ways that are invisible until the request is
 * rejected, so this conversion is not optional and must not be inlined per call
 * site:
 *
 * - The form models "nothing selected" as `null` (`catalogItemId`) or `""`
 *   (every other field), because that is what an empty input holds. The API
 *   models it as *absent* — `catalogItemId` is `z.string().uuid().optional()`
 *   on create, with no `.nullable()`, so a literal `null` is a 400, and `""`
 *   fails the uuid and numeric-string checks just as hard.
 * - `sortOrder` exists only here. The form keeps line items in array order and
 *   never carries an index, so it has to be assigned during conversion.
 *
 * /quotes had this mapping written inline while the customer detail page passed
 * its form state straight to `createQuote`, which did not compile and would not
 * have worked if it had: every quote raised from a customer would have been
 * rejected the moment a line item came from the catalog.
 */
export function toCreateQuotePayload(data: QuoteFormData) {
  return {
    customerId: data.customerId,
    issuedDate: data.issuedDate || undefined,
    expiryDate: data.expiryDate || undefined,
    taxRate: data.taxRate,
    discountAmount: data.discountAmount || undefined,
    notes: data.notes || undefined,
    equipmentId: data.equipmentId || undefined,
    // Sent with the quote rather than looped afterwards. The old flow created
    // the quote, then fired one server action per line — and because Next
    // queues server actions, the dialog sat open for the whole chain, and
    // stayed open entirely if any of them rejected, with the quote already
    // created behind it.
    lineItems: data.lineItems?.length
      ? data.lineItems.map((li, index) => ({
          description: li.description || undefined,
          itemType: li.itemType,
          quantity: li.quantity || undefined,
          unitPrice: li.unitPrice,
          sortOrder: index,
          ...(li.catalogItemId ? { catalogItemId: li.catalogItemId } : {}),
        }))
      : undefined,
  };
}
