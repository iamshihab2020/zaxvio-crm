/**
 * `trigger.quote.viewed`.
 *
 * `expiryDate` is on the output because the automation this node exists for
 * anchors a Wait on it — chase somebody who looked and went quiet *before* the
 * quote lapses, not after, when the answer is a fresh price rather than a nudge.
 */

import type { Executor } from "./types.js";

const triggerQuoteViewed: Executor = async ({ ctx }) => ({
  output: {
    quoteId: ctx.quote?.id ?? null,
    quoteNumber: ctx.quote?.number ?? null,
    total: ctx.quote?.total ?? null,
    expiryDate: ctx.quote?.expiryDate ?? null,
    // From the trigger payload, not the context: `restoreContext` re-reads the
    // quote, and the row's `first_viewed_at` is the same either way — but a
    // resumed run must report when they *actually* looked, not when it woke up.
    viewedAt: ctx.trigger.payload?.viewedAt ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerQuoteViewed;
