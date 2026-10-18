/**
 * Seed a tenant with two months of realistic, connected data.
 *
 *   pnpm seed:demo                       # seeds the default account below
 *   SEED_EMAIL=someone@example.com pnpm seed:demo
 *   pnpm seed:demo -- --reset            # replace this tenant's data with a fresh set
 *   pnpm seed:demo -- --wipe             # the "down": clear the data, seed nothing
 *
 * What gets written comes from `buildDemoDataset` (seed-demo-dataset.ts): the
 * last 60 days of work plus two weeks booked ahead, relative to today in the
 * tenant's timezone. This file only turns that dataset into rows.
 *
 * Scope and safety
 * ----------------
 * Everything is resolved from the *owner's email* to a single `tenants.id`, and
 * every insert and every delete is filtered on that id. The script never
 * touches `user`, `account`, `session`, `organization`, `member`, pipelines,
 * availability or workflows, so it cannot damage the login or the automations,
 * and it cannot reach another tenant's rows.
 *
 * `--reset` deletes and reseeds in ONE transaction: if the seed fails, the
 * tenant keeps the data it had. Without `--reset` it refuses to run against a
 * tenant that already has customers, because job, quote and invoice numbers
 * come from database triggers, so a second run would append, not replace.
 *
 * Rules borrowed from the app rather than restated
 * ------------------------------------------------
 * - Invoice status is derived from the payment rows by the live service
 *   (`deriveStatus`, `splitPayment`); `overdue` is never stored, readers derive
 *   it from `due_date`. Only `void` is asserted.
 * - Totals follow the services: tax on the subtotal, discount after tax.
 * - `jobs.status` is the stage's name and the stage is the real pointer.
 * - `jobs.actual_hours` is the rounded sum of the closed time entries, exactly
 *   as `recalculateJobHours` computes it, and each entry snapshots its
 *   hourly cost rate (member rate, else the tenant default).
 * - Line-item `total` and `cost_total` are GENERATED columns and are never
 *   inserted; job, quote and invoice numbers are left empty for the triggers.
 * - Activity rows use the same types and wording the routes write.
 */

import { config } from "dotenv";
import { randomUUID } from "crypto";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../../.env") });

import {
  getDb,
  closeDb,
  and,
  eq,
  sql,
  tenants,
  tenantMemberRates,
  customers,
  customerNotes,
  customerActivities,
  catalogItems,
  tags,
  customerTags,
  equipment,
  checklistTemplates,
  checklistItems,
  jobChecklistCompletions,
  pipelines,
  jobPipelineStages,
  jobs,
  jobLineItems,
  jobActivities,
  jobTimeEntries,
  jobExpenses,
  invoices,
  invoiceLineItems,
  invoicePayments,
  quotes,
  quoteLineItems,
  quoteActivities,
  bookings,
  bookingActivities,
  calendarEvents,
  maintenanceContracts,
  scheduleOverrides,
  notifications,
  notificationReads,
  organization,
  member,
  user as userTable,
} from "@hvac-saas/database";

import {
  addDays,
  deriveStatus,
  dueDateFromTerms,
  round2,
  splitPayment,
  type InvoiceStatus,
} from "../services/invoices/status.service.js";

import { buildDemoDataset } from "./seed-demo-dataset.js";
import type { DemoDataset, LineSpec, When } from "./seed-demo-types.js";

/* ── time ──────────────────────────────────────────────────────────────────
   The dataset speaks in "day offset + HH:MM in the tenant's timezone". `date`
   columns get the local calendar date; `timestamptz` columns get the real
   instant, so "08:00" shows as 08:00 in the tenant's zone whatever the zone of
   the machine running the script. */

function localDate(at: Date, timeZone: string): string {
  // en-CA renders ISO-ordered YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Minutes the zone is ahead of UTC at `at` (negative west of Greenwich). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a wall-clock time on a local date happens in `timeZone`. */
function zonedInstant(date: string, hhmm: string, timeZone: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, mi = 0] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = zoneOffsetMinutes(new Date(guess), timeZone);
  let t = guess - first * 60_000;
  const second = zoneOffsetMinutes(new Date(t), timeZone);
  if (second !== first) t = guess - second * 60_000;
  return new Date(t);
}

function money(n: number): string {
  return round2(n).toFixed(2);
}

function sumLines(lines: readonly LineSpec[]): number {
  return round2(lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0));
}

/* ── argument handling ─────────────────────────────────────────────────── */

const RESET = process.argv.includes("--reset");
/** The "down" half: clear this tenant's data and stop, without reseeding. */
const WIPE_ONLY = process.argv.includes("--wipe");
const OWNER_EMAIL =
  process.env.SEED_EMAIL?.trim() || "shihab.sharetasking@gmail.com";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Delete everything this script creates for one tenant. Child-before-parent;
 * rows without a tenant_id of their own (customer_tags, notification_reads)
 * go through their parent.
 */
async function wipeTenant(tx: Tx, tenantId: string): Promise<void> {
  await tx.delete(jobChecklistCompletions).where(eq(jobChecklistCompletions.tenantId, tenantId));
  await tx.delete(jobTimeEntries).where(eq(jobTimeEntries.tenantId, tenantId));
  await tx.delete(jobExpenses).where(eq(jobExpenses.tenantId, tenantId));
  await tx.delete(invoicePayments).where(eq(invoicePayments.tenantId, tenantId));
  await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.tenantId, tenantId));
  await tx.delete(invoices).where(eq(invoices.tenantId, tenantId));
  await tx.delete(quoteLineItems).where(eq(quoteLineItems.tenantId, tenantId));
  await tx.delete(quoteActivities).where(eq(quoteActivities.tenantId, tenantId));
  await tx.update(bookings).set({ quoteId: null }).where(eq(bookings.tenantId, tenantId));
  await tx.delete(quotes).where(eq(quotes.tenantId, tenantId));
  await tx.delete(jobLineItems).where(eq(jobLineItems.tenantId, tenantId));
  await tx.delete(jobActivities).where(eq(jobActivities.tenantId, tenantId));
  await tx.delete(calendarEvents).where(eq(calendarEvents.tenantId, tenantId));
  await tx.delete(bookingActivities).where(eq(bookingActivities.tenantId, tenantId));
  // bookings.converted_to_job_id and jobs.booking_id point at each other;
  // both are ON DELETE SET NULL, so break the cycle before deleting either.
  await tx.update(jobs).set({ bookingId: null }).where(eq(jobs.tenantId, tenantId));
  await tx.update(bookings).set({ convertedToJobId: null }).where(eq(bookings.tenantId, tenantId));
  await tx.delete(bookings).where(eq(bookings.tenantId, tenantId));
  await tx.delete(jobs).where(eq(jobs.tenantId, tenantId));
  await tx.delete(checklistItems).where(eq(checklistItems.tenantId, tenantId));
  await tx.delete(checklistTemplates).where(eq(checklistTemplates.tenantId, tenantId));
  await tx.delete(maintenanceContracts).where(eq(maintenanceContracts.tenantId, tenantId));
  await tx.delete(equipment).where(eq(equipment.tenantId, tenantId));
  await tx.delete(customerNotes).where(eq(customerNotes.tenantId, tenantId));
  await tx.delete(customerActivities).where(eq(customerActivities.tenantId, tenantId));
  await tx.execute(
    sql`DELETE FROM customer_tags WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = ${tenantId})`,
  );
  await tx.delete(tags).where(eq(tags.tenantId, tenantId));
  await tx.delete(customers).where(eq(customers.tenantId, tenantId));
  await tx.delete(catalogItems).where(eq(catalogItems.tenantId, tenantId));
  await tx.delete(scheduleOverrides).where(eq(scheduleOverrides.tenantId, tenantId));
  // notification_reads cascade with their notification.
  await tx.delete(notifications).where(eq(notifications.tenantId, tenantId));
}

async function main() {
  const db = getDb();

  /* 1. Resolve the tenant from the owner's email. ------------------------ */

  const [owner] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.email, OWNER_EMAIL));
  if (!owner) {
    throw new Error(`No user with email ${OWNER_EMAIL}. Sign up first, then re-run.`);
  }

  const [orgRow] = await db
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, owner.id));
  if (!orgRow) {
    throw new Error(`${OWNER_EMAIL} is not a member of any organization, so there is no tenant to seed.`);
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.organizationId, orgRow.id));
  if (!tenant) {
    throw new Error(`Organization "${orgRow.name}" has no tenants row. Visit the dashboard once to initialise it.`);
  }

  const tenantId = tenant.id;
  const userId = owner.id;
  const tz = tenant.timezone ?? "America/Chicago";

  // Member 0 is the owner; anyone else in the org follows in join order.
  const memberRows = await db
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(eq(member.organizationId, orgRow.id));
  const memberIds = [
    userId,
    ...memberRows.filter((r) => r.userId !== userId).map((r) => r.userId),
  ];
  const memberId = (i: number) => memberIds[i] ?? userId;

  const now = new Date();
  const today = localDate(now, tz);
  const latestPast = new Date(now.getTime() - 60_000);
  const dateOf = (offset: number) => addDays(today, offset);
  const instant = (w: When) => zonedInstant(dateOf(w.day), w.time, tz);
  /** For anything that has already happened: never later than a minute ago. */
  const happened = (w: When) => {
    const t = instant(w);
    return t > latestPast ? latestPast : t;
  };

  console.log(`Owner    ${owner.email} (${userId})`);
  console.log(`Tenant   ${tenant.businessName.trim()} (${tenantId})`);
  console.log(`Timezone ${tz}, today ${today}`);

  /* 2. Refuse to double-seed. --------------------------------------------- */

  const [countRow] = await db
    .select({ existing: sql<number>`count(*)::int` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const existing = countRow?.existing ?? 0;

  if (existing > 0 && !RESET && !WIPE_ONLY) {
    console.error(
      `\nTenant already has ${existing} customer(s). Refusing to seed on top of ` +
        `existing data — job and invoice numbers come from database triggers, so ` +
        `a second run appends rather than replaces.\n\n` +
        `Re-run with --reset to replace this tenant's data:\n` +
        `  pnpm seed:demo -- --reset\n`,
    );
    await closeDb();
    process.exit(1);
  }

  if (WIPE_ONLY) {
    await db.transaction((tx) => wipeTenant(tx, tenantId));
    console.log(`\nTenant is empty. Run \`pnpm seed:demo\` to fill it again.`);
    await closeDb();
    return;
  }

  /* 3. Build the dataset for today, then write it. ----------------------- */

  const DEMO: DemoDataset = buildDemoDataset(today);
  const counts: Record<string, number> = {};
  const track = (k: string, n: number) => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  await db.transaction(async (tx) => {
    if (RESET) {
      console.log("\n--reset: clearing this tenant's data (rolled back if the seed fails)…");
      await wipeTenant(tx, tenantId);
    }

    /* 3a. Business profile and the labour cost rate time entries snapshot. */
    await tx
      .update(tenants)
      .set({
        ownerName: DEMO.tenant.ownerName,
        phone: DEMO.tenant.phone,
        address: DEMO.tenant.address,
        city: DEMO.tenant.city,
        state: DEMO.tenant.state,
        zipCode: DEMO.tenant.zipCode,
        licenseNumber: DEMO.tenant.licenseNumber,
        defaultTaxRate: DEMO.tenant.defaultTaxRate,
        defaultLaborCostRate: money(DEMO.defaultLaborCostRate),
        invoicePaymentTerms: DEMO.tenant.invoicePaymentTerms,
        invoicePaymentInstructions: DEMO.tenant.invoicePaymentInstructions,
        invoiceTermsConditions: DEMO.tenant.invoiceTermsConditions,
        invoiceFooterMessage: DEMO.tenant.invoiceFooterMessage,
        quoteTermsConditions: DEMO.tenant.quoteTermsConditions,
        quoteFooterMessage: DEMO.tenant.quoteFooterMessage,
        googleReviewUrl: DEMO.tenant.googleReviewUrl,
        bookingSlotCapacity: DEMO.tenant.bookingSlotCapacity,
      })
      .where(eq(tenants.id, tenantId));

    const taxRate = DEMO.tenant.defaultTaxRate;
    const taxRateNum = Number(taxRate);

    const rateByMember = new Map<number, number>();
    for (const r of DEMO.memberRates) {
      rateByMember.set(r.member, r.rate);
      await tx
        .insert(tenantMemberRates)
        .values({ tenantId, userId: memberId(r.member), hourlyCostRate: money(r.rate) })
        .onConflictDoUpdate({
          target: [tenantMemberRates.tenantId, tenantMemberRates.userId],
          set: { hourlyCostRate: money(r.rate), updatedAt: new Date() },
        });
    }
    const costRateFor = (m: number) => money(rateByMember.get(m) ?? DEMO.defaultLaborCostRate);

    /* 3b. Pipeline stages: reuse the tenant's default pipeline. */
    const [defaultPipeline] = await tx
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.isDefault, true)));
    if (!defaultPipeline) {
      throw new Error("Tenant has no default pipeline. Open /jobs once so it is created, then re-run.");
    }
    const stages = await tx
      .select({
        id: jobPipelineStages.id,
        name: jobPipelineStages.name,
        label: jobPipelineStages.label,
        lifecycle: jobPipelineStages.lifecycle,
        sortOrder: jobPipelineStages.sortOrder,
      })
      .from(jobPipelineStages)
      .where(and(eq(jobPipelineStages.tenantId, tenantId), eq(jobPipelineStages.pipelineId, defaultPipeline.id)))
      .orderBy(jobPipelineStages.sortOrder);
    const stageFor = (lifecycle: "scheduled" | "in_progress" | "completed" | "cancelled") => {
      const s = stages.find((st) => st.lifecycle === lifecycle);
      if (!s) throw new Error(`The default pipeline has no "${lifecycle}" stage.`);
      return s;
    };

    /* 3c. Catalog and tags. */
    const catalogRows = await tx
      .insert(catalogItems)
      .values(
        DEMO.catalog.map((c) => ({
          tenantId,
          name: c.name,
          itemType: c.itemType,
          unitPrice: money(c.unitPrice),
          unitCost: c.unitCost === null ? null : money(c.unitCost),
          unit: c.unit,
          category: c.category,
          description: c.description,
          isActive: true,
          createdAt: happened({ day: -400, time: "09:00" }),
        })),
      )
      .returning({ id: catalogItems.id, name: catalogItems.name });
    track("catalog_items", catalogRows.length);
    const catalogId = (name: string | null) =>
      name === null ? null : (catalogRows.find((c) => c.name === name)?.id ?? null);

    const tagRows = await tx
      .insert(tags)
      .values(DEMO.tags.map((t) => ({ tenantId, name: t.name, color: t.color })))
      .returning({ id: tags.id, name: tags.name });
    track("tags", tagRows.length);
    const tagByName = new Map(tagRows.map((t) => [t.name, t.id]));

    /* 3d. Customers, tags, notes, activity. */
    const fullAddress = (c: DemoDataset["customers"][number]) =>
      `${c.address}, ${c.city}, ${c.state} ${c.zipCode}`;

    const customerRows = await tx
      .insert(customers)
      .values(
        DEMO.customers.map((c) => {
          const createdAt = happened(c.joined);
          return {
            tenantId,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
            address: c.address,
            city: c.city,
            state: c.state,
            zipCode: c.zipCode,
            notes: c.notes,
            emailOptOutAt: c.emailOptOutAt ? happened(c.emailOptOutAt) : null,
            emailOptOutSource: c.emailOptOutAt ? "unsubscribe_link" : null,
            createdAt,
            updatedAt: c.archivedAt ? happened(c.archivedAt) : createdAt,
            archivedAt: c.archivedAt ? happened(c.archivedAt) : null,
          };
        }),
      )
      .returning({ id: customers.id });
    track("customers", customerRows.length);
    const customerId = (i: number) => {
      const row = customerRows[i];
      if (!row) throw new Error(`No seeded customer at index ${i}`);
      return row.id;
    };
    const customerSpec = (i: number) => {
      const c = DEMO.customers[i];
      if (!c) throw new Error(`No customer spec at index ${i}`);
      return c;
    };
    const nameOf = (i: number) => `${customerSpec(i).firstName} ${customerSpec(i).lastName}`;

    const customerTagValues = DEMO.customers.flatMap((c, i) =>
      c.tags.map((name) => {
        const tagId = tagByName.get(name);
        if (!tagId) throw new Error(`Unknown tag "${name}"`);
        return { customerId: customerId(i), tagId };
      }),
    );
    if (customerTagValues.length > 0) {
      await tx.insert(customerTags).values(customerTagValues);
      track("customer_tags", customerTagValues.length);
    }

    if (DEMO.customerNotes.length > 0) {
      await tx.insert(customerNotes).values(
        DEMO.customerNotes.map((n) => ({
          tenantId,
          customerId: customerId(n.customer),
          content: n.content,
          createdBy: userId,
          createdAt: happened(n.at),
          updatedAt: happened(n.at),
        })),
      );
      track("customer_notes", DEMO.customerNotes.length);
    }

    /* 3e. Equipment and maintenance contracts. */
    const equipmentRows = await tx
      .insert(equipment)
      .values(
        DEMO.equipment.map((e) => ({
          tenantId,
          customerId: customerId(e.customer),
          equipmentType: e.equipmentType,
          brand: e.brand,
          model: e.model,
          serialNumber: e.serialNumber,
          installDate: dateOf(e.installDay),
          warrantyExpiry: dateOf(e.warrantyDay),
          location: e.location,
          notes: e.notes,
          createdAt: happened(e.created),
          updatedAt: happened(e.created),
        })),
      )
      .returning({ id: equipment.id });
    track("equipment", equipmentRows.length);
    const equipmentId = (i: number | null) => (i === null ? null : (equipmentRows[i]?.id ?? null));

    const customerActivityValues: (typeof customerActivities.$inferInsert)[] = [];
    DEMO.customers.forEach((c, i) => {
      customerActivityValues.push({
        tenantId,
        customerId: customerId(i),
        type: "customer.created",
        description: `Customer ${c.firstName} ${c.lastName} was created`,
        // Portal customers are created by the booking form, not by a person.
        performedBy: c.source === "portal" ? null : userId,
        createdAt: happened(c.joined),
      });
      if (c.emailOptOutAt) {
        customerActivityValues.push({
          tenantId,
          customerId: customerId(i),
          type: "customer.unsubscribed",
          description: "Customer unsubscribed from marketing email",
          performedBy: null,
          createdAt: happened(c.emailOptOutAt),
        });
      }
      if (c.archivedAt) {
        customerActivityValues.push({
          tenantId,
          customerId: customerId(i),
          type: "customer.archived",
          description: "Customer archived",
          performedBy: userId,
          createdAt: happened(c.archivedAt),
        });
      }
    });
    DEMO.equipment.forEach((e) => {
      customerActivityValues.push({
        tenantId,
        customerId: customerId(e.customer),
        type: "equipment.created",
        description: `Asset added: ${e.equipmentType} (${e.brand})`,
        performedBy: userId,
        createdAt: happened(e.created),
      });
    });
    DEMO.customerNotes.forEach((n) => {
      customerActivityValues.push({
        tenantId,
        customerId: customerId(n.customer),
        type: "note.created",
        description: "Added a note",
        performedBy: userId,
        createdAt: happened(n.at),
      });
    });
    await tx.insert(customerActivities).values(customerActivityValues);
    track("customer_activities", customerActivityValues.length);

    if (DEMO.contracts.length > 0) {
      await tx.insert(maintenanceContracts).values(
        DEMO.contracts.map((c) => ({
          tenantId,
          customerId: customerId(c.customer),
          equipmentId: equipmentId(c.equipment),
          contractName: c.name,
          startDate: dateOf(c.startDay),
          endDate: dateOf(c.endDay),
          frequency: c.frequency,
          visitsPerYear: c.visitsPerYear,
          annualPrice: money(c.annualPrice),
          isActive: true,
          notes: c.notes,
          createdAt: happened({ day: c.startDay, time: "10:00" }),
          updatedAt: happened({ day: c.startDay, time: "10:00" }),
        })),
      );
      track("maintenance_contracts", DEMO.contracts.length);
    }

    /* 3f. Checklist templates. */
    const templateRows = await tx
      .insert(checklistTemplates)
      .values(
        DEMO.checklists.map((t) => ({
          tenantId,
          serviceType: t.serviceType,
          name: t.name,
          isActive: true,
          createdAt: happened({ day: -400, time: "09:30" }),
        })),
      )
      .returning({ id: checklistTemplates.id });
    track("checklist_templates", templateRows.length);

    const itemValues = DEMO.checklists.flatMap((t, ti) => {
      const template = templateRows[ti];
      if (!template) throw new Error(`No template at index ${ti}`);
      return t.items.map((item, idx) => ({
        tenantId,
        templateId: template.id,
        label: item.label,
        isRequired: item.required,
        sortOrder: idx,
      }));
    });
    const itemRows = await tx
      .insert(checklistItems)
      .values(itemValues)
      .returning({ id: checklistItems.id, templateId: checklistItems.templateId, isRequired: checklistItems.isRequired });
    track("checklist_items", itemRows.length);

    const templateFor = new Map(
      DEMO.checklists.map((t, ti) => {
        const template = templateRows[ti];
        if (!template) throw new Error(`No template at index ${ti}`);
        return [t.serviceType, { id: template.id, name: t.name, items: itemRows.filter((r) => r.templateId === template.id) }];
      }),
    );

    /* 3g. Jobs, in the order they were created so JOB numbers rise with
           time. Time entries are resolved first: actual_hours comes from them. */
    type EntryRow = { started: Date; ended: Date; member: number; note: string | null };
    const entriesFor = DEMO.jobs.map((j) =>
      j.time
        .map((t): EntryRow => ({
          started: happened({ day: t.day, time: t.start }),
          ended: happened({ day: t.day, time: t.end }),
          member: t.member,
          note: t.note,
        }))
        .filter((e) => e.ended.getTime() - e.started.getTime() >= 5 * 60_000),
    );
    const hoursOf = (rows: EntryRow[]) => {
      if (rows.length === 0) return null;
      const seconds = rows.reduce((s, e) => s + (e.ended.getTime() - e.started.getTime()) / 1000, 0);
      return (Math.round((seconds / 3600) * 100) / 100).toFixed(2);
    };

    const jobOrder = DEMO.jobs
      .map((_, i) => i)
      .sort((a, b) => happened(DEMO.jobs[a]!.created).getTime() - happened(DEMO.jobs[b]!.created).getTime());
    const jobIdAt: string[] = new Array(DEMO.jobs.length);
    const jobNumberAt: string[] = new Array(DEMO.jobs.length);

    for (const [sortOrder, ji] of jobOrder.entries()) {
      const j = DEMO.jobs[ji];
      if (!j) continue;
      const stage = stageFor(j.lifecycle);
      const subtotal = sumLines(j.lines);
      const taxAmount = round2(subtotal * taxRateNum);
      const quoteDiscount = j.quote !== null ? (DEMO.quotes[j.quote]?.discount ?? 0) : 0;
      const total = round2(subtotal + taxAmount - quoteDiscount);
      const c = customerSpec(j.customer);
      const lastEvent = j.completed ?? j.cancelled?.at ?? j.startedAt ?? j.created;

      const [row] = await tx
        .insert(jobs)
        .values({
          tenantId,
          customerId: customerId(j.customer),
          equipmentId: equipmentId(j.equipment),
          pipelineId: defaultPipeline.id,
          stageId: stage.id,
          assigneeId: memberId(j.assignee),
          jobNumber: "", // issued by trg_jobs_auto_number
          status: stage.name, // the stage's name, never free text
          priority: j.priority,
          serviceType: j.serviceType,
          title: j.title,
          description: j.description,
          scheduledDate: dateOf(j.day),
          scheduledStart: j.start,
          scheduledEnd: j.end,
          address: fullAddress(c),
          subtotal: money(subtotal),
          taxRate,
          taxAmount: money(taxAmount),
          totalAmount: money(total),
          actualHours: hoursOf(entriesFor[ji] ?? []),
          notes: j.notes,
          sortOrder,
          completedAt: j.completed ? happened(j.completed) : null,
          createdAt: happened(j.created),
          updatedAt: happened(lastEvent),
        })
        .returning({ id: jobs.id, jobNumber: jobs.jobNumber });
      if (!row) throw new Error(`Failed to insert job "${j.title}"`);
      jobIdAt[ji] = row.id;
      jobNumberAt[ji] = row.jobNumber;
    }
    track("jobs", DEMO.jobs.length);
    const jobId = (i: number) => {
      const id = jobIdAt[i];
      if (!id) throw new Error(`No seeded job at index ${i}`);
      return id;
    };

    const jobLineValues = DEMO.jobs.flatMap((j, ji) =>
      j.lines.map((l, idx) => ({
        tenantId,
        jobId: jobId(ji),
        catalogItemId: catalogId(l.catalog),
        itemType: l.itemType,
        description: l.description,
        quantity: l.quantity.toFixed(2),
        unitPrice: money(l.unitPrice),
        unitCost: l.unitCost === null ? null : money(l.unitCost),
        sortOrder: idx,
        createdAt: happened(j.created),
      })),
    );
    if (jobLineValues.length > 0) {
      await tx.insert(jobLineItems).values(jobLineValues);
      track("job_line_items", jobLineValues.length);
    }

    const timeValues = DEMO.jobs.flatMap((_, ji) =>
      (entriesFor[ji] ?? []).map((e) => ({
        tenantId,
        jobId: jobId(ji),
        userId: memberId(e.member),
        startedAt: e.started,
        endedAt: e.ended,
        hourlyCostRate: costRateFor(e.member),
        note: e.note,
        createdBy: userId,
        createdAt: e.ended,
        updatedAt: e.ended,
      })),
    );
    const timeRows =
      timeValues.length > 0
        ? await tx
            .insert(jobTimeEntries)
            .values(timeValues)
            .returning({ id: jobTimeEntries.id, jobId: jobTimeEntries.jobId, startedAt: jobTimeEntries.startedAt, endedAt: jobTimeEntries.endedAt })
        : [];
    track("job_time_entries", timeRows.length);

    const expenseValues = DEMO.jobs.flatMap((j, ji) =>
      j.expenses.map((e) => ({
        tenantId,
        jobId: jobId(ji),
        category: e.category,
        description: e.description,
        amount: money(e.amount),
        incurredOn: dateOf(e.day),
        vendor: e.vendor,
        createdBy: memberId(e.member),
        createdAt: happened({ day: e.day, time: "18:10" }),
        updatedAt: happened({ day: e.day, time: "18:10" }),
      })),
    );
    const expenseRows =
      expenseValues.length > 0
        ? await tx
            .insert(jobExpenses)
            .values(expenseValues)
            .returning({ id: jobExpenses.id, jobId: jobExpenses.jobId, description: jobExpenses.description, amount: jobExpenses.amount, createdAt: jobExpenses.createdAt })
        : [];
    track("job_expenses", expenseRows.length);

    // Checklists: one row per template item, as attachChecklistToJob writes
    // them, ticked as far as the work got.
    const completionValues = DEMO.jobs.flatMap((j, ji) => {
      const template = templateFor.get(j.serviceType);
      if (!template) return [];
      const doneAt = j.completed ?? j.startedAt;
      return template.items.map((item, idx) => {
        const ticked =
          j.checklist === "all" ||
          (j.checklist === "required" && item.isRequired === true) ||
          (j.checklist === "partial" && idx < Math.ceil(template.items.length / 2));
        return {
          tenantId,
          jobId: jobId(ji),
          checklistItemId: item.id,
          isCompleted: ticked,
          completedBy: ticked ? userId : null,
          completedAt: ticked && doneAt ? happened(doneAt) : null,
        };
      });
    });
    if (completionValues.length > 0) {
      await tx.insert(jobChecklistCompletions).values(completionValues);
      track("job_checklist_completions", completionValues.length);
    }

    /* 3h. Quotes, in issue order. */
    const quoteOrder = DEMO.quotes
      .map((_, i) => i)
      .sort((a, b) => happened(DEMO.quotes[a]!.issued).getTime() - happened(DEMO.quotes[b]!.issued).getTime());
    const quoteIdAt: string[] = new Array(DEMO.quotes.length);
    const quoteNumberAt: string[] = new Array(DEMO.quotes.length);

    for (const qi of quoteOrder) {
      const q = DEMO.quotes[qi];
      if (!q) continue;
      const subtotal = sumLines(q.lines);
      const taxAmount = round2(subtotal * taxRateNum);
      const total = Math.max(0, round2(subtotal + taxAmount - q.discount));
      const issuedDate = dateOf(q.issued.day);
      const lastEvent = q.responded ?? q.viewed ?? q.sent ?? q.issued;

      const [row] = await tx
        .insert(quotes)
        .values({
          tenantId,
          customerId: customerId(q.customer),
          quoteNumber: "", // issued by trg_quotes_auto_number
          status: q.status,
          issuedDate,
          expiryDate: addDays(issuedDate, 30),
          subtotal: money(subtotal),
          taxRate,
          taxAmount: money(taxAmount),
          discountAmount: money(q.discount),
          totalAmount: money(total),
          notes: q.notes,
          equipmentId: equipmentId(q.equipment),
          // Only an accepted quote points at the job it became.
          convertedToJobId: q.status === "accepted" && q.job !== null ? jobId(q.job) : null,
          accessToken: q.sent ? randomUUID() : null,
          firstViewedAt: q.viewed ? happened(q.viewed) : null,
          declineReason: q.status === "declined" ? q.declineReason : null,
          createdAt: happened(q.issued),
          updatedAt: happened(lastEvent),
        })
        .returning({ id: quotes.id, quoteNumber: quotes.quoteNumber });
      if (!row) throw new Error("Failed to insert quote");
      quoteIdAt[qi] = row.id;
      quoteNumberAt[qi] = row.quoteNumber;
    }
    track("quotes", DEMO.quotes.length);
    const quoteId = (i: number) => {
      const id = quoteIdAt[i];
      if (!id) throw new Error(`No seeded quote at index ${i}`);
      return id;
    };

    const quoteLineValues = DEMO.quotes.flatMap((q, qi) =>
      q.lines.map((l, idx) => ({
        tenantId,
        quoteId: quoteId(qi),
        catalogItemId: catalogId(l.catalog),
        itemType: l.itemType,
        description: l.description,
        quantity: l.quantity.toFixed(2),
        unitPrice: money(l.unitPrice),
        sortOrder: idx,
        createdAt: happened(q.issued),
      })),
    );
    if (quoteLineValues.length > 0) {
      await tx.insert(quoteLineItems).values(quoteLineValues);
      track("quote_line_items", quoteLineValues.length);
    }

    /* 3i. Bookings. A converted booking carries the job link on BOTH sides. */
    let bookingIds: string[] = [];
    if (DEMO.bookings.length > 0) {
      const bookingRows = await tx
        .insert(bookings)
        .values(
          DEMO.bookings.map((b) => {
            const c = customerSpec(b.customer);
            const lastEvent = b.completedAt ?? b.cancelled?.at ?? b.rescheduled?.at ?? b.confirmedAt ?? b.created;
            return {
              tenantId,
              customerId: customerId(b.customer),
              customerName: nameOf(b.customer),
              customerEmail: c.email,
              customerPhone: c.phone,
              serviceType: b.serviceType,
              bookingDate: dateOf(b.day),
              preferredTime: b.time,
              address: fullAddress(c),
              description: b.description,
              status: b.status,
              source: b.source,
              convertedToJobId: b.job !== null ? jobId(b.job) : null,
              notes: b.notes,
              createdAt: happened(b.created),
              updatedAt: happened(lastEvent),
            };
          }),
        )
        .returning({ id: bookings.id });
      bookingIds = bookingRows.map((r) => r.id);
      track("bookings", bookingRows.length);
    }
    const bookingId = (i: number) => {
      const id = bookingIds[i];
      if (!id) throw new Error(`No seeded booking at index ${i}`);
      return id;
    };
    for (const [bi, b] of DEMO.bookings.entries()) {
      if (b.job === null) continue;
      await tx
        .update(jobs)
        .set({ bookingId: bookingId(bi) })
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId(b.job))));
    }

    /* 3j. Invoices, in issue order. Status is DERIVED from the payments. */
    const invoiceOrder = DEMO.invoices
      .map((_, i) => i)
      .sort((a, b) => happened(DEMO.invoices[a]!.issued).getTime() - happened(DEMO.invoices[b]!.issued).getTime());
    const invoiceIdAt: string[] = new Array(DEMO.invoices.length);
    const invoiceNumberAt: string[] = new Array(DEMO.invoices.length);
    const paymentAmounts: number[][] = DEMO.invoices.map(() => []);
    const invoiceFacts: { total: number; balance: number; dueDate: string | null }[] = new Array(DEMO.invoices.length);
    const invoiceLineValues: (typeof invoiceLineItems.$inferInsert)[] = [];
    const paymentValues: (typeof invoicePayments.$inferInsert)[] = [];

    for (const ii of invoiceOrder) {
      const inv = DEMO.invoices[ii];
      if (!inv) continue;
      const subtotal = sumLines(inv.lines);
      const taxAmount = round2(subtotal * taxRateNum);
      const discount = round2(inv.discount);
      const total = round2(subtotal + taxAmount - discount);

      // Resolve each payment's intent against the running balance, so "pay the
      // rest" stays true whatever the lines sum to.
      let running = 0;
      const amounts = inv.payments.map((p) => {
        const amount =
          p.share === "rest"
            ? round2(total - running + p.extra)
            : round2(total * p.share + p.extra);
        running = round2(running + amount);
        return amount;
      });
      paymentAmounts[ii] = amounts;
      const amountPaid = running;
      const { balanceDue, creditAmount } = splitPayment({ totalAmount: total, amountPaid });

      const base: InvoiceStatus = inv.void ? "void" : inv.sent ? "sent" : "draft";
      const status = deriveStatus({ current: base, totalAmount: total, amountPaid });

      const issuedDate = dateOf(inv.issued.day);
      const dueDate = dueDateFromTerms(issuedDate, DEMO.tenant.invoicePaymentTerms);
      invoiceFacts[ii] = { total, balance: balanceDue, dueDate };
      const overdue = dueDate !== null && dueDate < today && (status === "sent" || status === "partially_paid");
      const lastPaymentDay = inv.payments.reduce((d, p) => Math.max(d, p.day), inv.issued.day);

      const [row] = await tx
        .insert(invoices)
        .values({
          tenantId,
          customerId: customerId(inv.customer),
          jobId: inv.job !== null ? jobId(inv.job) : null,
          invoiceNumber: "", // issued by trg_invoices_auto_number
          status,
          issuedDate,
          dueDate,
          subtotal: money(subtotal),
          taxRate,
          taxAmount: money(taxAmount),
          discountAmount: money(discount),
          totalAmount: money(total),
          amountPaid: money(amountPaid),
          balanceDue: money(balanceDue),
          creditAmount: money(creditAmount),
          notes: inv.notes,
          // The overdue sweep has already sent its reminder for these.
          lastOverdueReminderAt:
            overdue && dueDate ? happened({ day: inv.issued.day + daysBetween(issuedDate, dueDate) + 1, time: "09:00" }) : null,
          createdAt: happened(inv.issued),
          updatedAt: happened({ day: lastPaymentDay, time: lastPaymentDay === inv.issued.day ? inv.issued.time : "12:00" }),
        })
        .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });
      if (!row) throw new Error("Failed to insert invoice");
      invoiceIdAt[ii] = row.id;
      invoiceNumberAt[ii] = row.invoiceNumber;

      inv.lines.forEach((l, idx) =>
        invoiceLineValues.push({
          tenantId,
          invoiceId: row.id,
          catalogItemId: catalogId(l.catalog),
          itemType: l.itemType,
          description: l.description,
          quantity: l.quantity.toFixed(2),
          unitPrice: money(l.unitPrice),
          sortOrder: idx,
          createdAt: happened(inv.issued),
        }),
      );
      inv.payments.forEach((p, pi) =>
        paymentValues.push({
          tenantId,
          invoiceId: row.id,
          amount: money(amounts[pi] ?? 0),
          paymentMethod: p.method,
          paymentDate: dateOf(p.day),
          referenceNumber: p.reference,
          notes: p.extra > 0 ? `Customer rounded up by $${p.extra.toFixed(2)}; held as credit.` : null,
          createdAt: happened({ day: p.day, time: p.day === inv.issued.day ? inv.issued.time : "12:00" }),
        }),
      );
    }
    track("invoices", DEMO.invoices.length);
    if (invoiceLineValues.length > 0) {
      await tx.insert(invoiceLineItems).values(invoiceLineValues);
      track("invoice_line_items", invoiceLineValues.length);
    }
    if (paymentValues.length > 0) {
      await tx.insert(invoicePayments).values(paymentValues);
      track("invoice_payments", paymentValues.length);
    }

    /* 3k. Calendar events and closed days. */
    if (DEMO.calendarEvents.length > 0) {
      await tx.insert(calendarEvents).values(
        DEMO.calendarEvents.map((e) => ({
          tenantId,
          title: e.title,
          description: e.description,
          eventDate: dateOf(e.day),
          startTime: e.start,
          endTime: e.end,
          contactName: e.contactName,
          contactPhone: e.contactPhone,
          address: e.address,
          notes: e.notes,
          color: e.color,
          customerId: e.customer !== null ? customerId(e.customer) : null,
          jobId: e.job !== null ? jobId(e.job) : null,
          createdAt: happened({ day: Math.min(e.day - 5, 0), time: "08:30" }),
          updatedAt: happened({ day: Math.min(e.day - 5, 0), time: "08:30" }),
        })),
      );
      track("calendar_events", DEMO.calendarEvents.length);
    }
    if (DEMO.scheduleOverrides.length > 0) {
      await tx.insert(scheduleOverrides).values(
        DEMO.scheduleOverrides.map((o) => ({
          tenantId,
          overrideDate: dateOf(o.day),
          isAvailable: false,
          reason: o.reason,
          createdAt: happened({ day: Math.min(o.day - 14, 0), time: "08:00" }),
        })),
      );
      track("schedule_overrides", DEMO.scheduleOverrides.length);
    }

    /* 3l. Activity timelines, worded the way the routes word them. */
    const jobActivityValues: (typeof jobActivities.$inferInsert)[] = [];
    const scheduled = stageFor("scheduled");
    const inProgress = stageFor("in_progress");
    DEMO.jobs.forEach((j, ji) => {
      const id = jobId(ji);
      const createdAt = happened(j.created);
      const customer = customerSpec(j.customer);
      jobActivityValues.push(
        j.booking !== null
          ? { tenantId, jobId: id, type: "job.created", description: "Job created from online booking", metadata: { bookingId: bookingId(j.booking) }, performedBy: userId, createdAt }
          : j.quote !== null
            ? { tenantId, jobId: id, type: "job.created", description: `Created from quote ${quoteNumberAt[j.quote] ?? ""}`, metadata: { quoteId: quoteId(j.quote) }, performedBy: userId, createdAt }
            : { tenantId, jobId: id, type: "job.created", description: `Job created for ${customer.firstName} ${customer.lastName}`, metadata: {}, performedBy: userId, createdAt },
      );
      const template = templateFor.get(j.serviceType);
      if (template) {
        jobActivityValues.push({
          tenantId,
          jobId: id,
          type: "checklist.attached",
          description: `Checklist "${template.name}" attached (${template.items.length} items)`,
          metadata: { templateId: template.id, templateName: template.name },
          performedBy: userId,
          createdAt: new Date(createdAt.getTime() + 1000),
        });
      }
      const move = (from: { name: string; lifecycle: string }, to: { id: string; name: string; label: string; lifecycle: string }, at: When) =>
        jobActivityValues.push({
          tenantId,
          jobId: id,
          type: "job.status_changed",
          description: `Status changed from ${from.name} to ${to.label}`,
          metadata: { from: from.name, to: to.name, fromLifecycle: from.lifecycle, toLifecycle: to.lifecycle, stageId: to.id },
          performedBy: userId,
          createdAt: happened(at),
        });
      if (j.startedAt) move(scheduled, inProgress, j.startedAt);
      if (j.completed) move(j.startedAt ? inProgress : scheduled, stageFor("completed"), j.completed);
      if (j.cancelled) move(scheduled, stageFor("cancelled"), j.cancelled.at);
    });
    for (const t of timeRows) {
      if (!t.endedAt) continue;
      const hours = (Math.round(((t.endedAt.getTime() - t.startedAt.getTime()) / 3_600_000) * 100) / 100).toFixed(2);
      jobActivityValues.push({
        tenantId,
        jobId: t.jobId,
        type: "time.logged",
        description: `Logged ${hours} hours`,
        metadata: { entryId: t.id },
        performedBy: userId,
        createdAt: t.endedAt,
      });
    }
    for (const e of expenseRows) {
      jobActivityValues.push({
        tenantId,
        jobId: e.jobId,
        type: "expense.added",
        description: `Added expense: ${e.description}`,
        metadata: { expenseId: e.id, amount: e.amount },
        performedBy: userId,
        createdAt: e.createdAt,
      });
    }
    await tx.insert(jobActivities).values(jobActivityValues);
    track("job_activities", jobActivityValues.length);

    const quoteActivityValues: (typeof quoteActivities.$inferInsert)[] = [];
    DEMO.quotes.forEach((q, qi) => {
      const id = quoteId(qi);
      quoteActivityValues.push({ tenantId, quoteId: id, type: "quote.created", description: `Quote ${quoteNumberAt[qi] ?? ""} created`, performedBy: userId, createdAt: happened(q.issued) });
      if (q.sent) {
        quoteActivityValues.push({ tenantId, quoteId: id, type: "quote.sent", description: "Quote sent", performedBy: userId, createdAt: happened(q.sent) });
      }
      if (q.responded && q.status === "accepted") {
        quoteActivityValues.push({
          tenantId,
          quoteId: id,
          type: "quote.accepted",
          description: q.respondedOnline ? "Quote accepted by customer online" : "Quote accepted",
          performedBy: q.respondedOnline ? null : userId,
          createdAt: happened(q.responded),
        });
      }
      if (q.responded && q.status === "declined") {
        const reason = q.declineReason ? ` — reason: "${q.declineReason}"` : "";
        quoteActivityValues.push({
          tenantId,
          quoteId: id,
          type: "quote.declined",
          description: q.respondedOnline ? `Quote declined by customer online${reason}` : "Quote declined",
          performedBy: q.respondedOnline ? null : userId,
          createdAt: happened(q.responded),
        });
      }
      if (q.status === "accepted" && q.job !== null) {
        const job = DEMO.jobs[q.job];
        quoteActivityValues.push({
          tenantId,
          quoteId: id,
          type: "quote.converted",
          description: `Converted to job ${jobNumberAt[q.job] ?? ""}`,
          metadata: { jobId: jobId(q.job) },
          performedBy: userId,
          createdAt: job ? happened(job.created) : happened(q.issued),
        });
      }
    });
    if (quoteActivityValues.length > 0) {
      await tx.insert(quoteActivities).values(quoteActivityValues);
      track("quote_activities", quoteActivityValues.length);
    }

    const bookingActivityValues: (typeof bookingActivities.$inferInsert)[] = [];
    DEMO.bookings.forEach((b, bi) => {
      const id = bookingId(bi);
      if (b.confirmedAt && (b.job === null || bi % 2 === 0)) {
        bookingActivityValues.push({
          tenantId,
          bookingId: id,
          type: "booking.status_changed",
          description: `Status changed from "pending" to "confirmed"`,
          metadata: { previousStatus: "pending", newStatus: "confirmed" },
          performedBy: userId,
          createdAt: happened(b.confirmedAt),
        });
      }
      if (b.rescheduled) {
        bookingActivityValues.push({
          tenantId,
          bookingId: id,
          type: "booking.rescheduled",
          description: `Rescheduled to ${dateOf(b.day)} at ${b.time}`,
          metadata: {
            previousDate: dateOf(b.rescheduled.fromDay),
            previousTime: b.rescheduled.fromTime,
            newDate: dateOf(b.day),
            newTime: b.time,
          },
          performedBy: userId,
          createdAt: happened(b.rescheduled.at),
        });
      }
      if (b.job !== null) {
        const job = DEMO.jobs[b.job];
        bookingActivityValues.push({
          tenantId,
          bookingId: id,
          type: "booking.converted",
          description: `Converted to job ${jobNumberAt[b.job] ?? ""}`,
          metadata: { jobId: jobId(b.job) },
          performedBy: userId,
          createdAt: job ? happened(job.created) : happened(b.created),
        });
      }
      if (b.completedAt) {
        bookingActivityValues.push({
          tenantId,
          bookingId: id,
          type: "booking.status_changed",
          description: `Status changed from "confirmed" to "completed"`,
          metadata: { previousStatus: "confirmed", newStatus: "completed" },
          performedBy: userId,
          createdAt: happened(b.completedAt),
        });
      }
      if (b.cancelled) {
        bookingActivityValues.push({
          tenantId,
          bookingId: id,
          type: "booking.cancelled",
          description: `Booking cancelled (was "${b.cancelled.was}")`,
          metadata: { previousStatus: b.cancelled.was },
          performedBy: userId,
          createdAt: happened(b.cancelled.at),
        });
      }
    });
    if (bookingActivityValues.length > 0) {
      await tx.insert(bookingActivities).values(bookingActivityValues);
      track("booking_activities", bookingActivityValues.length);
    }

    /* 3m. Notifications, worded like the routes that raise them. */
    const usd = (n: number) => `$${n.toFixed(2)}`;
    const notificationValues = DEMO.notifications.map((n, i) => {
      const base = {
        tenantId,
        type: n.type,
        actorId: null,
        dedupKey: `seed:${i}`,
        createdAt: happened(n.at),
      };
      switch (n.ref.kind) {
        case "booking": {
          const b = DEMO.bookings[n.ref.index];
          const name = b ? nameOf(b.customer) : "a customer";
          const date = b ? dateOf(b.day) : "";
          return n.type === "booking_cancelled"
            ? { ...base, title: `Booking cancelled — ${name}`, description: `${b?.serviceType ?? "service"} booking on ${date} was cancelled`, entityType: "booking", entityId: bookingId(n.ref.index), metadata: { bookingDate: date, serviceType: b?.serviceType } }
            : { ...base, title: `New booking from ${name}`, description: `${b?.serviceType ?? "service"} booking for ${date} at ${b?.time ?? ""}`, entityType: "booking", entityId: bookingId(n.ref.index), metadata: { bookingDate: date, serviceType: b?.serviceType } };
        }
        case "quote": {
          const q = DEMO.quotes[n.ref.index];
          const number = quoteNumberAt[n.ref.index] ?? "";
          const online = q?.respondedOnline ?? false;
          const verb = n.type === "quote_accepted" ? "accepted" : "declined";
          return {
            ...base,
            title: `Quote ${number} ${verb}${online ? " online" : ""}`,
            description: online && q ? `${nameOf(q.customer)} ${verb} the quote on the quote page` : `Quote has been ${verb}`,
            entityType: "quote",
            entityId: quoteId(n.ref.index),
            metadata: { quoteNumber: number },
          };
        }
        case "invoice": {
          const ii = n.ref.index;
          const number = invoiceNumberAt[ii] ?? "";
          const facts = invoiceFacts[ii];
          const inv = DEMO.invoices[ii];
          if (n.type === "invoice_overdue") {
            return {
              ...base,
              title: `Invoice ${number} is overdue`,
              description: `${inv ? nameOf(inv.customer) : "A customer"} owes ${usd(facts?.balance ?? 0)} — it was due ${facts?.dueDate ?? ""}`,
              entityType: "invoice",
              entityId: invoiceIdAt[ii] ?? null,
              metadata: { invoiceNumber: number, dueDate: facts?.dueDate ?? null },
            };
          }
          const amounts = paymentAmounts[ii] ?? [];
          const amount = amounts[n.payment] ?? 0;
          const paidSoFar = amounts.slice(0, n.payment + 1).reduce((s, a) => s + a, 0);
          const paidInFull = facts ? paidSoFar >= facts.total : false;
          return {
            ...base,
            title: `Payment of ${usd(amount)} received`,
            description: `Payment recorded for invoice ${number}${paidInFull ? " — fully paid" : ""}`,
            entityType: "invoice",
            entityId: invoiceIdAt[ii] ?? null,
            metadata: { invoiceNumber: number, amount: money(amount) },
          };
        }
        case "job": {
          const j = DEMO.jobs[n.ref.index];
          return { ...base, title: j?.title ?? "Job updated", description: "Job status changed", entityType: "job", entityId: jobId(n.ref.index), metadata: {} };
        }
        case "customer":
          return { ...base, title: `New customer: ${nameOf(n.ref.index)}`, description: `${nameOf(n.ref.index)} was added to your customer list`, entityType: "customer", entityId: customerId(n.ref.index), metadata: {} };
      }
    });
    if (notificationValues.length > 0) {
      const notificationRows = await tx
        .insert(notifications)
        .values(notificationValues)
        .returning({ id: notifications.id, createdAt: notifications.createdAt });
      track("notifications", notificationRows.length);
      const readValues = notificationRows.flatMap((row, i) =>
        DEMO.notifications[i]?.read
          ? [{ notificationId: row.id, userId, readAt: new Date(Math.min(row.createdAt.getTime() + 45 * 60_000, latestPast.getTime())) }]
          : [],
      );
      if (readValues.length > 0) {
        await tx.insert(notificationReads).values(readValues);
        track("notification_reads", readValues.length);
      }
    }
  });

  console.log("\nSeeded:");
  for (const [table, n] of Object.entries(counts).sort()) {
    console.log(`  ${table.padEnd(28)} ${n}`);
  }
  console.log(`\nSign in as ${OWNER_EMAIL} to see it.`);

  await closeDb();
}

/** Whole days from one YYYY-MM-DD to another. */
function daysBetween(from: string, to: string): number {
  const [fy = 1970, fm = 1, fd = 1] = from.split("-").map(Number);
  const [ty = 1970, tm = 1, td = 1] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  await closeDb().catch(() => {});
  process.exit(1);
});
