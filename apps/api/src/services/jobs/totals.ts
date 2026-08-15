/**
 * A job's money, recomputed from its line items.
 *
 * ## Why this is its own module
 *
 * It was a private function in `routes/jobs/index.ts` with **six** callers —
 * the update handler, all three line-item handlers and both branches of the
 * checklist toggle (an item linked to a catalog entry adds and removes a line
 * item, and both sides move the total). Extracting the handlers one at a time
 * meant the first one to move would have to either import from a route file or
 * take a copy, and a second copy of "what does this job cost" is the shape of
 * defect this service directory exists to stop.
 *
 * ## The `Db` type is load-bearing
 *
 * `Omit<…, "$client">` rather than the bare handle. A Drizzle transaction has
 * every query method but no `$client`, so typing this as
 * `ReturnType<typeof getDb>` makes the function **uncallable from inside a
 * transaction** — it does not fail at run time, it fails to compile at the call
 * site, so the fix looks like "move this statement out of the transaction".
 *
 * That is the same defect found in `job-stages.service.ts` (QUO-02) and again
 * in `availability.service.ts`, which is three occurrences of one mistake. Here
 * it mattered directly: this was the one statement in `PATCH /jobs/:id` that
 * could not join the other four when they became a transaction.
 */

import {
  getDb,
  jobs,
  jobLineItems,
  and,
  eq,
  sql,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Recompute `subtotal`, `taxAmount` and `totalAmount` from the job's line items.
 *
 * `total` on a line item is a GENERATED column, so the sum is taken over
 * `quantity * unit_price` rather than over `total` — the generated value is
 * correct, but summing it would mean trusting the database to have already
 * applied a write this transaction may not have committed yet.
 */
export async function recalculateJobTotals(
  db: Db,
  jobId: string,
  tenantId: string,
): Promise<void> {
  const result = await db
    .select({
      subtotal: sql<string>`COALESCE(SUM(quantity * unit_price), 0)`,
    })
    .from(jobLineItems)
    .where(
      and(eq(jobLineItems.jobId, jobId), eq(jobLineItems.tenantId, tenantId)),
    );

  const subtotal = result[0]?.subtotal ?? "0";

  const [job] = await db
    .select({ taxRate: jobs.taxRate })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)));

  const taxRate = parseFloat(job?.taxRate ?? "0");
  const subtotalNum = parseFloat(subtotal);
  const taxAmount = subtotalNum * taxRate;
  const totalAmount = subtotalNum + taxAmount;

  await db
    .update(jobs)
    .set({
      subtotal: subtotalNum.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)));
}
