/**
 * Email cron jobs — daily scheduled email triggers.
 *
 * E-07: Invoice overdue reminders (daily)
 * E-09: Maintenance contract renewal reminders (daily)
 * E-10: Trial expiring warnings (daily)
 * E-12: Review requests, two hours after an invoice is paid in full
 */

import { z } from "zod";
import {
  getDb,
  invoices,
  customers,
  tenants,
  maintenanceContracts,
  user,
  member,
  eq,
  and,
  lt,
  gte,
  lte,
  sql,
} from "@hvac-saas/database";
import { isNull } from "drizzle-orm";
import {
  sendInvoiceOverdueEmail,
  sendContractRenewalEmail,
  sendTrialExpiringEmail,
  sendReviewRequestEmail,
} from "../email.js";
import { canEmailCustomer, unsubscribeUrl } from "../email-consent.js";

type Db = ReturnType<typeof getDb>;

/**
 * The row shape the overdue claim returns. Validated per [[api-rules]] §4 —
 * raw SQL results are where database schema drift shows up first.
 */
const overdueClaimRow = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  invoice_number: z.string(),
  due_date: z.string(),
  balance_due: z.string(),
  days_overdue: z.coerce.number().int(),
});
type OverdueClaim = z.infer<typeof overdueClaimRow>;

/**
 * E-07: Send overdue invoice reminders.
 *
 * Three things were wrong here, all of them about *which* invoices count.
 *
 * INV-06 — the definition of overdue. The list and the stats endpoint both
 * derived it as `status NOT IN ('paid','void') AND due_date < today in the
 * tenant's timezone`. This used `now().toISOString().split("T")[0]` — server
 * UTC — and restricted itself to `status IN ('sent','overdue')`. So a
 * `partially_paid` invoice past its due date was counted as overdue everywhere
 * in the UI but never chased: a customer who paid half and then stopped was
 * never followed up. And for a tenant west of UTC the reminder fired up to a
 * day before the app agreed the invoice was late.
 *
 * INV-07 — archived invoices were emailed about. Archiving is the product's
 * "make this go away" action; it did not stop the dunning email. Every other
 * invoice read path filters `archived_at`.
 *
 * INV-30 — every API instance runs this interval, and `lastOverdueReminderAt`
 * only narrows the window: two instances could both read "not yet reminded"
 * and both send. The claim below is a single `UPDATE … RETURNING`, so a row is
 * stamped and handed to exactly one instance atomically. It also means a
 * crash-loop is no longer a mailing-loop — the boot run finds the rows already
 * claimed.
 */
export async function processOverdueInvoiceReminders(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Bound parameters in a raw `sql` template go straight to postgres.js, which
  // serialises strings and numbers but throws ERR_INVALID_ARG_TYPE on a Date
  // ("must be of type string or an instance of Buffer"). Drizzle's query
  // builder converts Dates for you; `db.execute(sql`…`)` does not. Every
  // timestamp interpolated below must therefore be an ISO string.
  const nowIso = now.toISOString();
  const twentyFourHoursAgoIso = twentyFourHoursAgo.toISOString();

  try {
    // Claim first, send second. `due_date < (now() AT TIME ZONE t.timezone)`
    // is the same predicate `overdueCondition()` builds for the list and the
    // stats endpoint, expressed against the joined tenant row so one statement
    // can span tenants in different zones.
    const claimed = await db.execute(sql`
      UPDATE invoices AS i
      SET last_overdue_reminder_at = ${nowIso}, status = 'overdue', updated_at = ${nowIso}
      FROM tenants AS t
      WHERE t.id = i.tenant_id
        AND i.archived_at IS NULL
        AND i.status IN ('sent', 'partially_paid', 'overdue')
        AND i.balance_due > 0
        AND i.due_date IS NOT NULL
        AND i.due_date < (now() AT TIME ZONE t.timezone)::date
        AND (
          i.last_overdue_reminder_at IS NULL
          OR i.last_overdue_reminder_at < ${twentyFourHoursAgoIso}
        )
      RETURNING
        i.id,
        i.tenant_id,
        i.customer_id,
        i.invoice_number,
        i.due_date,
        i.balance_due,
        ((now() AT TIME ZONE t.timezone)::date - i.due_date) AS days_overdue
    `);

    const rows = z.array(overdueClaimRow).parse(Array.from(claimed));

    for (const row of rows) {
      try {
        await deliverOverdueReminder(db, row);
      } catch (err) {
        console.error(`[email-cron] E-07 failed for invoice ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[email-cron] processOverdueInvoiceReminders failed:", err);
  }
}

/** Send one E-07 for an already-claimed row. */
async function deliverOverdueReminder(db: Db, row: OverdueClaim): Promise<void> {
  const [customer, tenant] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, row.customer_id)).then((r) => r[0]),
    db.select().from(tenants).where(eq(tenants.id, row.tenant_id)).then((r) => r[0]),
  ]);

  if (!customer?.email) return;

  await sendInvoiceOverdueEmail({
    to: customer.email,
    props: {
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      businessName: tenant?.businessName ?? "HVAC Service",
      businessLogoUrl: tenant?.logoUrl ?? null,
      businessPhone: tenant?.phone ?? null,
      businessAddress: tenant?.address ?? null,
      invoiceNumber: row.invoice_number,
      dueDate: formatDateOnly(row.due_date),
      daysOverdue: row.days_overdue,
      balanceDue: parseFloat(row.balance_due),
      paymentInstructions: tenant?.invoicePaymentInstructions ?? null,
    },
  });

  console.info(
    `[email-cron] E-07 sent for invoice ${row.invoice_number} (${row.days_overdue}d overdue)`,
  );
}

/**
 * Send an overdue reminder for one invoice, now.
 *
 * Backs `POST /invoices/:id/remind`. Dunning was cron-only and fired at most
 * once per 24h, so a contractor who wanted to nudge a customer had no button
 * (report §4.2). Claims the row the same way the cron does, so pressing the
 * button twice in a row sends once.
 */
export async function sendOverdueReminder(
  db: Db,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  // ISO strings, not Dates — see processOverdueInvoiceReminders above.
  const nowIso = now.toISOString();
  const fiveMinutesAgoIso = fiveMinutesAgo.toISOString();

  const claimed = await db.execute(sql`
    UPDATE invoices AS i
    SET last_overdue_reminder_at = ${nowIso}, updated_at = ${nowIso}
    FROM tenants AS t
    WHERE t.id = i.tenant_id
      AND i.id = ${invoiceId}
      AND i.archived_at IS NULL
      AND i.status IN ('sent', 'partially_paid', 'overdue')
      AND i.balance_due > 0
      AND i.due_date IS NOT NULL
      AND (
        i.last_overdue_reminder_at IS NULL
        OR i.last_overdue_reminder_at < ${fiveMinutesAgoIso}
      )
    RETURNING
      i.id,
      i.tenant_id,
      i.customer_id,
      i.invoice_number,
      i.due_date,
      i.balance_due,
      GREATEST(0, (now() AT TIME ZONE t.timezone)::date - i.due_date) AS days_overdue
  `);

  const rows = z.array(overdueClaimRow).parse(Array.from(claimed));
  if (rows.length === 0) {
    return {
      ok: false,
      message: "A reminder was already sent for this invoice in the last few minutes",
    };
  }

  await deliverOverdueReminder(db, rows[0]);
  return { ok: true };
}

const reviewClaimRow = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
});

/**
 * E-12: Review requests, two hours after an invoice is paid in full.
 *
 * This lived in an in-memory `setTimeout` inside the payment handler, so any
 * deploy, crash or scale event dropped every pending request silently — and
 * there was no record that one had been intended (INV-29 / DF-INV-04). The
 * payment handler writes `review_email_scheduled_at` now and this picks it up,
 * claiming with the same `UPDATE … RETURNING` so two instances cannot both send.
 */
export async function processReviewRequests(): Promise<void> {
  const db = getDb();
  const now = new Date();
  // ISO string, not a Date — see processOverdueInvoiceReminders above.
  const nowIso = now.toISOString();

  try {
    const claimed = await db.execute(sql`
      UPDATE invoices
      SET review_requested_at = ${nowIso}, review_email_scheduled_at = NULL, updated_at = ${nowIso}
      WHERE review_email_scheduled_at IS NOT NULL
        AND review_email_scheduled_at <= ${nowIso}
        AND review_requested_at IS NULL
        AND status = 'paid'
        AND archived_at IS NULL
      RETURNING id, tenant_id, customer_id
    `);

    const rows = z.array(reviewClaimRow).parse(Array.from(claimed));

    for (const row of rows) {
      try {
        const [customer, tenant] = await Promise.all([
          db.select().from(customers).where(eq(customers.id, row.customer_id)).then((r) => r[0]),
          db.select().from(tenants).where(eq(tenants.id, row.tenant_id)).then((r) => r[0]),
        ]);

        if (!customer || !tenant?.googleReviewUrl) continue;

        // "Please leave us a review" is not transactional — the customer did not
        // ask for it and it does not concern money they owe. It is one of the
        // two sends DF-NOT-01 named as the reason an opt-out had to exist at
        // all, so it goes through the one gate rather than checking
        // `customer.email` and hoping.
        const consent = await canEmailCustomer(db, {
          tenantId: row.tenant_id,
          customerId: row.customer_id,
          purpose: "marketing",
        });
        if (!consent.allowed || !consent.email) {
          console.info(`[email-cron] E-12 skipped for invoice ${row.id}: ${consent.reason}`);
          continue;
        }

        await sendReviewRequestEmail({
          to: consent.email,
          unsubscribeUrl: unsubscribeUrl(row.tenant_id, row.customer_id),
          props: {
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            businessName: tenant.businessName ?? "HVAC Service",
            businessLogoUrl: tenant.logoUrl ?? null,
            businessPhone: tenant.phone ?? null,
            businessAddress: tenant.address ?? null,
            googleReviewUrl: tenant.googleReviewUrl,
          },
        });

        console.info(`[email-cron] E-12 sent for invoice ${row.id}`);
      } catch (err) {
        console.error(`[email-cron] E-12 failed for invoice ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[email-cron] processReviewRequests failed:", err);
  }
}

/** `YYYY-MM-DD` → "Jul 29, 2026", without the UTC-midnight day shift. */
function formatDateOnly(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * E-09: Send maintenance contract renewal reminders.
 * Targets active contracts expiring within 30 days that haven't been reminded yet.
 */
export async function processContractRenewalReminders(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;

  try {
    const expiringContracts = await db
      .select()
      .from(maintenanceContracts)
      .where(
        and(
          eq(maintenanceContracts.isActive, true),
          gte(maintenanceContracts.endDate, today),
          lte(maintenanceContracts.endDate, thirtyDaysFromNow),
          isNull(maintenanceContracts.renewalReminderSentAt),
        ),
      );

    for (const contract of expiringContracts) {
      try {
        const [customer, tenant] = await Promise.all([
          db.select().from(customers).where(eq(customers.id, contract.customerId)).then((r) => r[0]),
          db.select().from(tenants).where(eq(tenants.id, contract.tenantId)).then((r) => r[0]),
        ]);

        if (!customer) continue;

        // The second of DF-NOT-01's two non-transactional sends. A renewal
        // reminder is a sales message about a contract that has not been
        // renewed — the recipient owes nothing and asked for nothing.
        const consent = await canEmailCustomer(db, {
          tenantId: contract.tenantId,
          customerId: contract.customerId,
          purpose: "marketing",
        });
        if (!consent.allowed || !consent.email) {
          console.info(`[email-cron] E-09 skipped for contract ${contract.id}: ${consent.reason}`);
          // Deliberately NOT marked as reminded. If this customer resubscribes
          // while the contract is still inside its 30-day window, they should
          // get the reminder — stamping `renewalReminderSentAt` here would
          // record a send that never happened and suppress the real one.
          continue;
        }

        const endDate = new Date(contract.endDate + "T00:00:00");
        const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        await sendContractRenewalEmail({
          to: consent.email,
          unsubscribeUrl: unsubscribeUrl(contract.tenantId, contract.customerId),
          props: {
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            businessName: tenant?.businessName ?? "HVAC Service",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            contractName: contract.contractName,
            endDate: endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            daysUntilExpiry,
            annualPrice: parseFloat(contract.annualPrice ?? "0"),
            visitsPerYear: contract.visitsPerYear,
          },
        });

        // Mark reminder sent
        await db
          .update(maintenanceContracts)
          .set({ renewalReminderSentAt: now })
          .where(eq(maintenanceContracts.id, contract.id));

        console.info(`[email-cron] E-09 sent for contract "${contract.contractName}" (${daysUntilExpiry}d left)`);
      } catch (err) {
        console.error(`[email-cron] E-09 failed for contract ${contract.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[email-cron] processContractRenewalReminders failed:", err);
  }
}

/**
 * E-10: Send trial expiring warnings.
 * Targets tenants whose trial ends within 3 days and haven't been warned yet.
 */
export async function processTrialExpiryWarnings(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    const expiringTenants = await db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.isActive, true),
          gte(tenants.trialEndsAt, now),
          lte(tenants.trialEndsAt, threeDaysFromNow),
          isNull(tenants.trialExpiryEmailSentAt),
        ),
      );

    for (const tenant of expiringTenants) {
      try {
        // Find the org owner's email
        if (!tenant.organizationId) continue;

        const ownerMember = await db
          .select({ userId: member.userId })
          .from(member)
          .where(and(eq(member.organizationId, tenant.organizationId), eq(member.role, "owner")))
          .then((r) => r[0]);

        if (!ownerMember) continue;

        const ownerUser = await db
          .select({ name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, ownerMember.userId))
          .then((r) => r[0]);

        if (!ownerUser?.email) continue;

        const trialEnd = new Date(tenant.trialEndsAt!);
        const daysRemaining = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        await sendTrialExpiringEmail({
          to: ownerUser.email,
          props: {
            ownerName: ownerUser.name ?? "there",
            businessName: tenant.businessName ?? "Your Business",
            daysRemaining,
            upgradeUrl: `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/settings/billing`,
          },
        });

        // Mark email sent
        await db
          .update(tenants)
          .set({ trialExpiryEmailSentAt: now })
          .where(eq(tenants.id, tenant.id));

        console.info(`[email-cron] E-10 sent for tenant "${tenant.businessName}" (${daysRemaining}d left)`);
      } catch (err) {
        console.error(`[email-cron] E-10 failed for tenant ${tenant.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[email-cron] processTrialExpiryWarnings failed:", err);
  }
}

/**
 * Expire quotes whose `expiry_date` has passed **in the tenant's own timezone**.
 *
 * This work used to run at the top of `GET /quotes` and `GET /quotes/:id` — a
 * write on a read path, firing an UPDATE across the tenant's whole quote table
 * on every list render — and it computed "today" as
 * `new Date().toISOString().split("T")[0]`, i.e. server UTC. Verified at
 * `2026-08-02 02:00 UTC`: UTC says `08-02` while `America/Chicago` says
 * `08-01`, so a quote valid until today was already expired through the
 * tenant's entire evening, which is when a homeowner actually reads an
 * estimate (QUO-09).
 *
 * Reads now derive the display status instead, so the UI is correct the instant
 * a quote lapses; this sweep is what makes the stored column agree. One
 * statement spanning tenants in different zones, same shape as the overdue
 * claim above.
 */
export async function processQuoteExpiry(): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();

  try {
    const expired = await db.execute(sql`
      UPDATE quotes AS q
      SET status = 'expired', updated_at = ${nowIso}
      FROM tenants AS t
      WHERE t.id = q.tenant_id
        AND q.status = 'sent'
        AND q.expiry_date IS NOT NULL
        AND q.expiry_date < (now() AT TIME ZONE t.timezone)::date
      RETURNING q.id
    `);

    const count = Array.from(expired).length;
    if (count > 0) {
      console.info(`[email-cron] Expired ${count} quote(s)`);
    }
  } catch (err) {
    console.error("[email-cron] Quote expiry sweep failed:", err);
  }
}

/**
 * Start all email cron jobs with setInterval.
 * Call this once from server startup.
 */
export function startEmailCronJobs(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  const SIX_HOURS = 6 * ONE_HOUR;
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  // Every instance runs these intervals — the fix for that is not to stop them
  // running but to make the work idempotent, which each processor now is: they
  // claim their rows with a single `UPDATE … RETURNING` before sending, so two
  // instances firing at the same moment split the work rather than duplicating
  // it, and a crash-loop finds the rows already claimed (INV-30).
  setInterval(() => {
    processOverdueInvoiceReminders().catch((err) =>
      console.error("[email-cron] Overdue invoice cron failed:", err),
    );
  }, SIX_HOURS);

  setInterval(() => {
    processContractRenewalReminders().catch((err) =>
      console.error("[email-cron] Contract renewal cron failed:", err),
    );
  }, SIX_HOURS);

  setInterval(() => {
    processTrialExpiryWarnings().catch((err) =>
      console.error("[email-cron] Trial expiry cron failed:", err),
    );
  }, SIX_HOURS);

  // E-12 is scheduled two hours out, so a 6-hour sweep would make "two hours
  // after payment" mean anything up to eight. Fifteen minutes is close enough
  // to the intent and cheap — the query is an indexed partial scan.
  setInterval(() => {
    processReviewRequests().catch((err) =>
      console.error("[email-cron] Review request cron failed:", err),
    );
  }, FIFTEEN_MINUTES);

  // Quote expiry is a date boundary, so hourly keeps the stored column within an
  // hour of the derived one every read already shows.
  setInterval(() => {
    processQuoteExpiry().catch((err) =>
      console.error("[email-cron] Quote expiry cron failed:", err),
    );
  }, ONE_HOUR);

  console.info(
    "[email-cron] Email cron jobs started (6h interval, 15m for E-12, 1h for quote expiry)",
  );

  // Run once on startup after a brief delay
  setTimeout(() => {
    processOverdueInvoiceReminders().catch(console.error);
    processContractRenewalReminders().catch(console.error);
    processTrialExpiryWarnings().catch(console.error);
    processReviewRequests().catch(console.error);
    processQuoteExpiry().catch(console.error);
  }, 10_000); // 10s delay to let server finish starting
}
