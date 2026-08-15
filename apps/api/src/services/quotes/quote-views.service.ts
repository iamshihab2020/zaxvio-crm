/**
 * Recording that a customer opened their quote. P9.
 *
 * ## A write on a GET, which this file is otherwise against
 *
 * `GET /public/quote/:token` used to `UPDATE` the row on every read, and QUO-09
 * is what that cost: expiry was written in **UTC**, so for a Chicago tenant a
 * quote valid until today already read as expired from 7pm the evening before.
 * The fix was to derive expiry and let a cron own the write, and the comment
 * there says so — *"reads just show the truth"*.
 *
 * So this write earns its exception explicitly:
 *
 * - It happens **at most once per quote, ever** (`WHERE first_viewed_at IS
 *   NULL`), not on every read. A second view writes nothing and touches no row.
 * - It records a fact about the *read itself*, which nothing else can observe.
 *   Expiry was derivable from data already stored; "they opened it" is not.
 * - It is fire-and-forget. A failure here must never turn a customer's attempt
 *   to look at their quote into a 500.
 *
 * ## First, not last
 *
 * The automation worth building is "they looked and then went quiet". A column
 * that moved on every view would restart that clock each time they glanced at it
 * again — so the chase would never fire for the customer who keeps re-reading
 * and never decides, which is exactly the customer to chase.
 */

import { quotes, and, eq, isNull, type getDb } from "@hvac-saas/database";
import { emitQuoteViewedEvent } from "./quote-events.service.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface RecordQuoteViewArgs {
  tenantId: string;
  quoteId: string;
}

/**
 * Stamp the first view and raise `quote.viewed`.
 *
 * Returns whether this was the first — the caller does not currently use it, but
 * a test does, and a function whose only signal is a side effect is a function
 * that cannot be proven.
 */
export async function recordQuoteView(
  db: Db,
  args: RecordQuoteViewArgs,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // The `IS NULL` predicate is the idempotency, in the WHERE clause rather
    // than in a read-then-write. Two tabs opened at the same instant both run
    // this; exactly one updates a row, so exactly one event is raised.
    const updated = await tx
      .update(quotes)
      .set({ firstViewedAt: new Date() })
      .where(
        and(
          eq(quotes.tenantId, args.tenantId),
          eq(quotes.id, args.quoteId),
          isNull(quotes.firstViewedAt),
        ),
      )
      .returning({ firstViewedAt: quotes.firstViewedAt });

    if (updated.length === 0) return false;

    // In the same transaction as the stamp, like every other producer. An event
    // that could commit without its write would fire an automation for a view
    // the database does not record — and one that could not commit *with* it
    // would leave a quote marked viewed that no automation ever heard about.
    //
    // The emitter re-reads the quote and its customer to build the payload,
    // which is the established shape here: a caller assembling one by hand is
    // how two producers of the same event come to disagree about a field.
    await emitQuoteViewedEvent(tx, {
      tenantId: args.tenantId,
      actorUserId: null,
      quoteId: args.quoteId,
      viewedAt: updated[0].firstViewedAt ?? new Date(),
    });

    return true;
  });
}
