/**
 * The `invoice.overdue` sweep.
 *
 * Almost every workflow event is raised by the write that causes it. This one
 * has no such write: nothing *happens* to make an invoice overdue except time
 * passing. So it needs a clock, and this is it.
 *
 * ## Why it exists at all
 *
 * `trigger.invoice.overdue` shipped into `ACTIVE_NODES` in P5 — a definition, a
 * payload schema, an executor, and a place in the palette — while the event it
 * declares had **no producer anywhere**. A tenant could build "chase an invoice
 * seven days after it's due", publish it, switch it on, and it would never fire.
 * Silently, forever. The ship gate asserts that an active node has a definition
 * and an executor; it did not assert that a *trigger* node's events can actually
 * be raised, which is a hole exactly the size of this bug and is now closed by a
 * test.
 *
 * ## Once per invoice per tenant-day
 *
 * The node filters `daysOverdue` with `equals` and its own help text says to add
 * one trigger per reminder — 1 day, then 7, then 14. That only works if the
 * event fires **every day** the invoice is overdue, carrying that day's count.
 * Firing once, when it first goes past due, would make every filter except `1`
 * unreachable.
 *
 * Exactly-once-per-day is the producer's `dedupKey` — `invoice.overdue:<id>:<local
 * date>` — which the queue's unique index enforces per subscriber. That holds
 * across restarts, overlapping ticks and two API instances, none of which a
 * "have we done this today" flag in memory would survive.
 *
 * ## Deliberately not coupled to the E-07 reminder cron
 *
 * E-07 sweeps overdue invoices too, and reusing its claim was tempting — it
 * already writes `last_overdue_reminder_at`. But that column exists to throttle
 * *emails*, so an automation firing off the back of it would silently stop the
 * day someone stopped their reminder emails. Two concerns, two sweeps, one
 * shared definition of overdue.
 */

import { getDb, sql } from "@hvac-saas/database";
import { z } from "zod";
import { invoiceOverdue } from "../events/producers/invoice.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Rows per tick.
 *
 * A bound rather than a promise there will never be more: a tenant importing a
 * year of unpaid invoices must not make one tick run for minutes. What is
 * dropped is logged — a silent cap reads as "we covered everything".
 */
const BATCH_LIMIT = 500;

/**
 * Stop raising the event past this many days overdue.
 *
 * Without it the sweep is **unbounded**: an invoice that went bad two years ago
 * still produces a queue row every single day, forever, matching no trigger —
 * the shipped chase template filters on 1, 7 and 14. The rows are dutifully
 * enqueued, processed, matched against nothing and completed, and the table
 * grows for as long as the invoice sits there.
 *
 * Six months is well past the point where an automation is the right answer. An
 * invoice this old is a write-off or a legal matter, and a tenant who wants to
 * chase at day 200 can still do it — the trigger fires, this is only the sweep's
 * horizon — by writing off the invoice or voiding it, which is what they should
 * be doing anyway.
 */
const MAX_DAYS_OVERDUE = 180;

/** Validated per [[api-rules]] §4 — a raw row is schema drift waiting to happen. */
const overdueRow = z.object({
  invoice_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  invoice_number: z.string(),
  status: z.enum(["draft", "sent", "paid", "partially_paid", "overdue", "void"]),
  total_amount: z.string(),
  amount_paid: z.string(),
  balance_due: z.string(),
  issued_date: z.string().nullable(),
  due_date: z.string(),
  job_id: z.string().uuid().nullable(),
  customer_id: z.string().uuid(),
  customer_first_name: z.string(),
  customer_last_name: z.string(),
  customer_email: z.string().nullable(),
  customer_phone: z.string().nullable(),
  days_overdue: z.coerce.number().int(),
  /** The tenant's own today, which is what "once a day" has to mean. */
  local_date: z.string(),
});

export interface SweepResult {
  scanned: number;
  emitted: number;
  /** Already raised for this invoice today — the normal case on a re-run. */
  deduped: number;
  /** True when the batch limit bit and rows were left for the next tick. */
  truncated: boolean;
}

export async function sweepOverdueInvoices(db: Db = getDb()): Promise<SweepResult> {
  // `db.execute` resolves to the row array itself, not a `{ rows }` wrapper —
  // the driver wrappers differ and `retention.ts` reads both defensively for
  // DELETE counts. For a SELECT the array is the result.
  const raw = await db.execute(sql`
    SELECT
      i.id                AS invoice_id,
      i.tenant_id         AS tenant_id,
      i.invoice_number    AS invoice_number,
      i.status            AS status,
      i.total_amount      AS total_amount,
      i.amount_paid       AS amount_paid,
      i.balance_due       AS balance_due,
      i.issued_date       AS issued_date,
      i.due_date          AS due_date,
      i.job_id            AS job_id,
      c.id                AS customer_id,
      c.first_name        AS customer_first_name,
      c.last_name         AS customer_last_name,
      c.email             AS customer_email,
      c.phone             AS customer_phone,
      ((now() AT TIME ZONE t.timezone)::date - i.due_date) AS days_overdue,
      (now() AT TIME ZONE t.timezone)::date                AS local_date
    FROM invoices i
    JOIN tenants t   ON t.id = i.tenant_id
    JOIN customers c ON c.id = i.customer_id AND c.tenant_id = i.tenant_id
    WHERE i.archived_at IS NULL
      AND i.due_date IS NOT NULL
      -- INV-06's shared definition of overdue. The cron's old copy restricted to
      -- ('sent','overdue'), so a customer who paid half and stopped showed as
      -- overdue everywhere in the UI and was never chased. "partially_paid"
      -- belongs here for the same reason.
      AND i.status IN ('sent', 'partially_paid', 'overdue')
      -- Compared in the TENANT's timezone, not the server's. On Neon the server
      -- is UTC, so a Chicago tenant would see an invoice go overdue six hours
      -- early — and "overdue" is a word customers get emailed about.
      AND i.due_date < (now() AT TIME ZONE t.timezone)::date
      -- The horizon. See MAX_DAYS_OVERDUE — without this the sweep raises an
      -- event a day, forever, for every invoice that was ever written off.
      -- "::int" is load-bearing: Postgres has both "date - integer -> date" and
      -- "date - date -> integer", and a bound parameter arrives untyped, so the
      -- operator would be ambiguous without it.
      AND i.due_date >= (now() AT TIME ZONE t.timezone)::date - ${MAX_DAYS_OVERDUE}::int
      -- Only where somebody is listening. "trigger_types" is written by the
      -- PUBLISH path and is what makes an automation reachable at all, so this
      -- is the same question the trigger matcher asks. Without it every tenant
      -- pays a queue row per overdue invoice per day for a feature they do not
      -- use.
      AND EXISTS (
        SELECT 1
        FROM workflows w
        JOIN workflow_versions v ON v.id = w.active_version_id
        WHERE w.tenant_id = i.tenant_id
          AND w.is_active = true
          AND w.archived_at IS NULL
          -- EVENT names, not node ids: "collectTriggerTypes" fills this column
          -- from "def.triggerEvents". Writing the node id here was the same
          -- mistake the trigger matcher had made, and it would have made this
          -- sweep silently emit nothing at all.
          AND v.trigger_types && ARRAY['invoice.overdue']
      )
    ORDER BY i.due_date ASC
    LIMIT ${BATCH_LIMIT + 1}
  `);

  const all = z.array(overdueRow).parse(Array.from(raw));
  const truncated = all.length > BATCH_LIMIT;
  const rows = truncated ? all.slice(0, BATCH_LIMIT) : all;

  let emitted = 0;
  let deduped = 0;

  for (const row of rows) {
    try {
      const result = await invoiceOverdue(db, {
        tenantId: row.tenant_id,
        // A sweep has no actor. Null rather than a system id, because a system
        // id is a user row that does not exist.
        actorUserId: null,
        invoice: {
          id: row.invoice_id,
          invoiceNumber: row.invoice_number,
          status: row.status,
          totalAmount: row.total_amount,
          amountPaid: row.amount_paid,
          balanceDue: row.balance_due,
          issuedDate: row.issued_date,
          dueDate: row.due_date,
          jobId: row.job_id,
        },
        customer: {
          id: row.customer_id,
          firstName: row.customer_first_name,
          lastName: row.customer_last_name,
          email: row.customer_email,
          phone: row.customer_phone,
        },
        daysOverdue: row.days_overdue,
        dedupKey: `invoice.overdue:${row.invoice_id}:${row.local_date}`,
      });

      if (result.deduped) deduped += 1;
      else emitted += 1;
    } catch (error) {
      // One bad invoice must not stop the sweep. `emitWorkflowEvent` throws on a
      // payload that fails its schema, which is a producer bug worth seeing —
      // but seeing it should not cost every other tenant their chase emails.
      console.error(
        `[workflow] invoice.overdue failed for invoice ${row.invoice_id}`,
        error,
      );
    }
  }

  if (truncated) {
    console.warn(
      `[workflow] invoice.overdue sweep hit its ${BATCH_LIMIT}-row limit; the rest run on the next tick`,
    );
  }

  return { scanned: rows.length, emitted, deduped, truncated };
}
