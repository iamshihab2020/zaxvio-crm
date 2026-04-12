/**
 * Email cron jobs — daily scheduled email triggers.
 *
 * E-07: Invoice overdue reminders (daily)
 * E-09: Maintenance contract renewal reminders (daily)
 * E-10: Trial expiring warnings (daily)
 */

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
  gt,
  gte,
  lte,
  or,
  sql,
} from "@hvac-saas/database";
import { isNull } from "drizzle-orm";
import {
  sendInvoiceOverdueEmail,
  sendContractRenewalEmail,
  sendTrialExpiringEmail,
} from "../email.js";

/**
 * E-07: Send overdue invoice reminders.
 * Targets invoices with status "sent" that are past due with a balance > 0.
 * Only sends once per 24 hours per invoice (via lastOverdueReminderAt).
 */
export async function processOverdueInvoiceReminders(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Find overdue invoices
    const overdueInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          or(eq(invoices.status, "sent" as never), eq(invoices.status, "overdue" as never)),
          lt(invoices.dueDate, today),
          gt(invoices.balanceDue, "0"),
          or(
            isNull(invoices.lastOverdueReminderAt),
            lt(invoices.lastOverdueReminderAt, twentyFourHoursAgo),
          ),
        ),
      );

    for (const inv of overdueInvoices) {
      try {
        const [customer, tenant] = await Promise.all([
          db.select().from(customers).where(eq(customers.id, inv.customerId)).then((r) => r[0]),
          db.select().from(tenants).where(eq(tenants.id, inv.tenantId)).then((r) => r[0]),
        ]);

        if (!customer?.email) continue;

        const dueDate = new Date(inv.dueDate + "T00:00:00");
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 0) continue;

        await sendInvoiceOverdueEmail({
          to: customer.email,
          props: {
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            businessName: tenant?.businessName ?? "HVAC Service",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            invoiceNumber: inv.invoiceNumber,
            dueDate: dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            daysOverdue,
            balanceDue: parseFloat(inv.balanceDue),
            paymentInstructions: tenant?.invoicePaymentInstructions ?? null,
          },
        });

        // Mark reminder sent and set status to overdue
        await db
          .update(invoices)
          .set({ lastOverdueReminderAt: now, status: "overdue" as never })
          .where(eq(invoices.id, inv.id));

        console.info(`[email-cron] E-07 sent for invoice ${inv.invoiceNumber} (${daysOverdue}d overdue)`);
      } catch (err) {
        console.error(`[email-cron] E-07 failed for invoice ${inv.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[email-cron] processOverdueInvoiceReminders failed:", err);
  }
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

        if (!customer?.email) continue;

        const endDate = new Date(contract.endDate + "T00:00:00");
        const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        await sendContractRenewalEmail({
          to: customer.email,
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
 * Start all email cron jobs with setInterval.
 * Call this once from server startup.
 */
export function startEmailCronJobs(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  const SIX_HOURS = 6 * ONE_HOUR;

  // Run overdue reminders every 6 hours
  setInterval(() => {
    processOverdueInvoiceReminders().catch((err) =>
      console.error("[email-cron] Overdue invoice cron failed:", err),
    );
  }, SIX_HOURS);

  // Run contract renewal check every 6 hours
  setInterval(() => {
    processContractRenewalReminders().catch((err) =>
      console.error("[email-cron] Contract renewal cron failed:", err),
    );
  }, SIX_HOURS);

  // Run trial expiry check every 6 hours
  setInterval(() => {
    processTrialExpiryWarnings().catch((err) =>
      console.error("[email-cron] Trial expiry cron failed:", err),
    );
  }, SIX_HOURS);

  console.info("[email-cron] Email cron jobs started (6h interval)");

  // Run once on startup after a brief delay
  setTimeout(() => {
    processOverdueInvoiceReminders().catch(console.error);
    processContractRenewalReminders().catch(console.error);
    processTrialExpiryWarnings().catch(console.error);
  }, 10_000); // 10s delay to let server finish starting
}
