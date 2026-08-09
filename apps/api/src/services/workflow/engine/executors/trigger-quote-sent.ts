/**
 * `trigger.quote.sent`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every matching record in the
 * tenant, then discarding almost all of them.
 *
 * So by the time this executes the decision is already made, and it only has to
 * hand the next step something to reference.
 *
 * `expiryDate` is here because the obvious automation on a sent quote is to
 * chase it before it lapses, and a Wait step can anchor on it directly.
 */

import type { Executor } from "./types.js";

const triggerQuoteSent: Executor = async ({ ctx }) => ({
  output: {
    quoteId: ctx.quote?.id ?? null,
    quoteNumber: ctx.quote?.number ?? null,
    total: ctx.quote?.total ?? null,
    expiryDate: ctx.quote?.expiryDate ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerQuoteSent;
