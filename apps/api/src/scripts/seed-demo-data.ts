/**
 * Seed a tenant with a realistic working dataset.
 *
 *   pnpm seed:demo                       # seeds the default account below
 *   SEED_EMAIL=someone@example.com pnpm seed:demo
 *   pnpm seed:demo -- --reset            # wipe this tenant's data first, then reseed
 *   pnpm seed:demo -- --wipe             # the "down": clear the data, seed nothing
 *
 * `--wipe` removes only what this script creates. The tenant row, the owner's
 * login, the default pipeline and the weekly availability all survive, so the
 * account is left exactly as it was before the first seed — not deleted.
 *
 * Scope and safety
 * ----------------
 * Everything is resolved from the *owner's email* to a single `tenants.id`, and
 * every insert and every delete is filtered on that id. The script never
 * touches `user`, `account`, `session`, `organization` or `member`, so it cannot
 * damage the login, and it cannot reach another tenant's rows.
 *
 * Without `--reset` it refuses to run against a tenant that already has
 * customers, because a second run would double the dataset rather than replace
 * it — invoice and job numbers are issued by database triggers, so there is no
 * natural key to upsert on.
 *
 * Why the money is computed here rather than written as literals
 * -------------------------------------------------------------
 * `deriveStatus`, `splitPayment` and `dueDateFromTerms` are imported from the
 * live invoice service. That service is the only thing allowed to decide what
 * an invoice's status is (see services/invoices/status.service.ts) — status is
 * *derived* from the payment rows, not chosen. If a seed hardcoded
 * `status: "paid"` on an invoice with no payments, the first edit in the UI
 * would silently re-derive it to `sent` and the seeded data would contradict
 * itself. Importing the real functions means this file cannot drift from the
 * rules the application enforces.
 *
 * Line-item `total` columns are GENERATED ALWAYS (`quantity * unit_price`) and
 * are deliberately never inserted. Job, invoice and quote numbers are left
 * empty so the `generate_*_number()` BEFORE INSERT triggers issue them in the
 * tenant's own sequence.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../../.env") });

import {
  getDb,
  closeDb,
  and,
  eq,
  sql,
  tenants,
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
  organization,
  member,
  user as userTable,
} from "@hvac-saas/database";

import {
  deriveStatus,
  splitPayment,
  round2,
  dueDateFromTerms,
  type InvoiceStatus,
} from "../services/invoices/status.service.js";

import { DEMO, type Money } from "./seed-demo-dataset.js";

/* ── date helpers ──────────────────────────────────────────────────────────
   Every date in the dataset is expressed as an offset in days from "today", so
   the seeded tenant always has work in the recent past, work today, and work
   booked ahead — regardless of when the script is run. Dates are formatted as
   plain YYYY-MM-DD in the tenant's timezone: `date` columns have no zone, and
   building them from a UTC instant is what made completion emails stamp the
   wrong day (lessons/frontend-nextjs.md, jobs audit).
   ───────────────────────────────────────────────────────────────────────── */

function dayOffset(days: number, timeZone: string): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + days * 86_400_000);
  // en-CA renders ISO-ordered YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function instantOffset(days: number, hour = 12): Date {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function money(n: number): string {
  return round2(n).toFixed(2);
}

function sumLines(lines: readonly { quantity: number; unitPrice: Money }[]) {
  return round2(
    lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0),
  );
}

/* ── argument handling ─────────────────────────────────────────────────── */

const RESET = process.argv.includes("--reset");
/** The "down" half: clear this tenant's data and stop, without reseeding. */
const WIPE_ONLY = process.argv.includes("--wipe");
const OWNER_EMAIL =
  process.env.SEED_EMAIL?.trim() || "shihab.sharetasking@gmail.com";

async function main() {
  const db = getDb();

  /* 1. Resolve the tenant from the owner's email. ------------------------ */

  const [owner] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.email, OWNER_EMAIL));

  if (!owner) {
    throw new Error(
      `No user with email ${OWNER_EMAIL}. Sign up first, then re-run.`,
    );
  }

  const [orgRow] = await db
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, owner.id));

  if (!orgRow) {
    throw new Error(
      `${OWNER_EMAIL} is not a member of any organization, so there is no tenant to seed.`,
    );
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.organizationId, orgRow.id));

  if (!tenant) {
    throw new Error(
      `Organization "${orgRow.name}" has no tenants row. Visit the dashboard once to initialise it.`,
    );
  }

  const tenantId = tenant.id;
  const userId = owner.id;
  const tz = tenant.timezone ?? "America/Chicago";

  console.log(`Owner    ${owner.email} (${userId})`);
  console.log(`Tenant   ${tenant.businessName.trim()} (${tenantId})`);
  console.log(`Timezone ${tz}`);

  /* 2. Refuse to double-seed, or wipe on --reset. ------------------------ */

  const [{ existing }] = await db
    .select({ existing: sql<number>`count(*)::int` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  if (existing > 0 && !RESET && !WIPE_ONLY) {
    console.error(
      `\nTenant already has ${existing} customer(s). Refusing to seed on top of ` +
        `existing data — job and invoice numbers come from database triggers, so ` +
        `a second run appends rather than replaces.\n\n` +
        `Re-run with --reset to clear this tenant's data first:\n` +
        `  pnpm seed:demo -- --reset\n`,
    );
    await closeDb();
    process.exit(1);
  }

  if (RESET || WIPE_ONLY) {
    console.log(
      `\n${WIPE_ONLY ? "--wipe" : "--reset"}: clearing this tenant's data…`,
    );
    // Child-before-parent. Rows without a tenant_id of their own (line items on
    // another tenant's invoice, customer_tags) are reached through their parent.
    await db.transaction(async (tx) => {
      await tx.delete(jobChecklistCompletions).where(eq(jobChecklistCompletions.tenantId, tenantId));
      await tx.delete(invoicePayments).where(eq(invoicePayments.tenantId, tenantId));
      await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.tenantId, tenantId));
      await tx.delete(invoices).where(eq(invoices.tenantId, tenantId));
      await tx.delete(quoteLineItems).where(eq(quoteLineItems.tenantId, tenantId));
      await tx.delete(quoteActivities).where(eq(quoteActivities.tenantId, tenantId));
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
      await tx.delete(notifications).where(eq(notifications.tenantId, tenantId));
    });
    console.log("cleared.");

    if (WIPE_ONLY) {
      // The tenant, its owner, the login, the pipeline and the weekly
      // availability all survive — only the content this script creates is
      // removed, so the account is exactly as it was before the first seed.
      console.log(
        `\nTenant is empty. Run \`pnpm seed:demo\` to fill it again.`,
      );
      await closeDb();
      return;
    }
  }

  /* 3. Seed. Single transaction: either the tenant gets a coherent dataset
        or it keeps the one it had. --------------------------------------- */

  const counts: Record<string, number> = {};
  const track = (k: string, n: number) => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  await db.transaction(async (tx) => {
    /* 3a. Business profile — the fields invoices, quote PDFs and the public
           booking portal all read. They were entirely null. */
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

    const taxRate = DEMO.tenant.defaultTaxRate; // string, numeric(5,4)
    const taxRateNum = Number(taxRate);

    /* 3b. Pipeline stages — reuse whatever this tenant already has. The stage
           is the real pointer; `jobs.status` is its name denormalised, and the
           two must never disagree. */
    const stages = await tx
      .select({
        id: jobPipelineStages.id,
        name: jobPipelineStages.name,
        label: jobPipelineStages.label,
        lifecycle: jobPipelineStages.lifecycle,
      })
      .from(jobPipelineStages)
      .where(eq(jobPipelineStages.tenantId, tenantId));

    if (stages.length === 0) {
      throw new Error(
        "Tenant has no pipeline stages. Open /jobs once so the default pipeline is created, then re-run.",
      );
    }

    const stageByLifecycle = new Map(stages.map((s) => [s.lifecycle, s]));
    const pickStage = (lifecycle: "scheduled" | "in_progress" | "completed") => {
      const s = stageByLifecycle.get(lifecycle) ?? stageByLifecycle.get("scheduled");
      if (!s) throw new Error(`No stage for lifecycle ${lifecycle}`);
      return s;
    };

    const [defaultPipeline] = await tx
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.isDefault, true)));

    const pipelineId = defaultPipeline?.id ?? null;

    /* 3c. Catalog. */
    const catalogRows = await tx
      .insert(catalogItems)
      .values(
        DEMO.catalog.map((c) => ({
          tenantId,
          name: c.name,
          itemType: c.itemType,
          unitPrice: money(c.unitPrice),
          unit: c.unit,
          category: c.category,
          description: c.description,
          isActive: true,
        })),
      )
      .returning({ id: catalogItems.id, name: catalogItems.name });
    track("catalog_items", catalogRows.length);
    const catalogByName = new Map(catalogRows.map((c) => [c.name, c.id]));

    /* 3d. Tags. */
    const tagRows = await tx
      .insert(tags)
      .values(DEMO.tags.map((t) => ({ tenantId, name: t.name, color: t.color })))
      .returning({ id: tags.id, name: tags.name });
    track("tags", tagRows.length);
    const tagByName = new Map(tagRows.map((t) => [t.name, t.id]));

    /* 3e. Customers, their tags, notes and activity. */
    const customerRows = await tx
      .insert(customers)
      .values(
        DEMO.customers.map((c) => ({
          tenantId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: c.state,
          zipCode: c.zipCode,
          notes: c.notes ?? null,
          createdAt: instantOffset(c.createdDaysAgo * -1, 9),
          archivedAt: c.archived ? instantOffset(-5, 9) : null,
        })),
      )
      .returning({ id: customers.id });
    track("customers", customerRows.length);

    const customerId = (i: number) => {
      const row = customerRows[i];
      if (!row) throw new Error(`No seeded customer at index ${i}`);
      return row.id;
    };

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

    const noteValues = DEMO.customerNotes.map((n) => ({
      tenantId,
      customerId: customerId(n.customer),
      content: n.content,
      createdBy: userId,
      createdAt: instantOffset(-n.daysAgo, 14),
    }));
    await tx.insert(customerNotes).values(noteValues);
    track("customer_notes", noteValues.length);

    const customerActivityValues = DEMO.customers.map((c, i) => ({
      tenantId,
      customerId: customerId(i),
      type: "customer_created",
      description: `${c.firstName} ${c.lastName} added to customers`,
      performedBy: userId,
      createdAt: instantOffset(-c.createdDaysAgo, 9),
    }));
    await tx.insert(customerActivities).values(customerActivityValues);
    track("customer_activities", customerActivityValues.length);

    /* 3f. Equipment — for a roofing business this is the roof system, the
           gutters and anything else with a warranty clock. */
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
          installDate: dayOffset(-e.installedDaysAgo, tz),
          warrantyExpiry: dayOffset(e.warrantyDaysAhead, tz),
          location: e.location,
          notes: e.notes ?? null,
        })),
      )
      .returning({ id: equipment.id });
    track("equipment", equipmentRows.length);

    /* 3g. Checklist templates. */
    const templateRows = await tx
      .insert(checklistTemplates)
      .values(
        DEMO.checklists.map((t) => ({
          tenantId,
          serviceType: t.serviceType,
          name: t.name,
          isActive: true,
        })),
      )
      .returning({ id: checklistTemplates.id });
    track("checklist_templates", templateRows.length);

    const checklistItemValues = DEMO.checklists.flatMap((t, ti) =>
      t.items.map((label, idx) => {
        const template = templateRows[ti];
        if (!template) throw new Error(`No template at index ${ti}`);
        return {
          tenantId,
          templateId: template.id,
          label,
          isRequired: idx < 3,
          sortOrder: idx,
        };
      }),
    );
    const checklistItemRows = await tx
      .insert(checklistItems)
      .values(checklistItemValues)
      .returning({ id: checklistItems.id, templateId: checklistItems.templateId });
    track("checklist_items", checklistItemRows.length);

    /* 3h. Jobs. `jobNumber: ""` lets generate_job_number() issue
           JOB-<year>-NNNN in the tenant's own sequence. Money is summed from
           the line items rather than written twice. */
    const jobIds: string[] = [];

    for (const j of DEMO.jobs) {
      const stage = pickStage(j.lifecycle);
      const subtotal = sumLines(j.lines);
      const taxAmount = round2(subtotal * taxRateNum);
      const total = round2(subtotal + taxAmount);

      const [job] = await tx
        .insert(jobs)
        .values({
          tenantId,
          customerId: customerId(j.customer),
          pipelineId,
          stageId: stage.id,
          assigneeId: userId,
          jobNumber: "", // issued by trg_jobs_auto_number
          status: stage.name, // denormalised stage name — never free text
          priority: j.priority,
          serviceType: j.serviceType,
          title: j.title,
          description: j.description,
          scheduledDate: dayOffset(j.dayOffset, tz),
          scheduledStart: j.start,
          scheduledEnd: j.end,
          address: DEMO.customers[j.customer]?.address ?? null,
          subtotal: money(subtotal),
          taxRate,
          taxAmount: money(taxAmount),
          totalAmount: money(total),
          notes: j.notes ?? null,
          sortOrder: jobIds.length,
          // Only a completed job has a completion instant.
          completedAt:
            j.lifecycle === "completed" ? instantOffset(j.dayOffset, 16) : null,
          createdAt: instantOffset(j.dayOffset - 3, 10),
        })
        .returning({ id: jobs.id });

      if (!job) throw new Error(`Failed to insert job "${j.title}"`);
      jobIds.push(job.id);

      if (j.lines.length > 0) {
        await tx.insert(jobLineItems).values(
          j.lines.map((l, idx) => ({
            tenantId,
            jobId: job.id,
            catalogItemId: l.catalog ? (catalogByName.get(l.catalog) ?? null) : null,
            itemType: l.itemType,
            description: l.description,
            quantity: l.quantity.toFixed(2),
            unitPrice: money(l.unitPrice),
            sortOrder: idx,
            // `total` is GENERATED ALWAYS AS (quantity * unit_price) — inserting
            // it is an error, and computing it here would let it drift.
          })),
        );
        track("job_line_items", j.lines.length);
      }

      await tx.insert(jobActivities).values({
        tenantId,
        jobId: job.id,
        type: "job_created",
        description: `Job created and placed in ${stage.label}`,
        performedBy: userId,
        createdAt: instantOffset(j.dayOffset - 3, 10),
      });
      track("job_activities", 1);
    }
    track("jobs", jobIds.length);

    const jobId = (i: number) => {
      const id = jobIds[i];
      if (id === undefined) throw new Error(`No seeded job at index ${i}`);
      return id;
    };

    /* 3i. Checklist completions on finished jobs — the completion gate reads
           these, so a completed job with an unticked required item would be an
           inconsistent state the UI can never produce. */
    const firstTemplateItems = checklistItemRows.filter(
      (r) => r.templateId === templateRows[0]?.id,
    );
    const completionValues = DEMO.jobs.flatMap((j, i) =>
      j.lifecycle === "completed"
        ? firstTemplateItems.map((item) => ({
            tenantId,
            jobId: jobId(i),
            checklistItemId: item.id,
            isCompleted: true,
            completedBy: userId,
            completedAt: instantOffset(j.dayOffset, 15),
          }))
        : [],
    );
    if (completionValues.length > 0) {
      await tx.insert(jobChecklistCompletions).values(completionValues);
      track("job_checklist_completions", completionValues.length);
    }

    /* 3j. Invoices. Status is DERIVED from the payment rows via the live
           service — never asserted. See the header comment. */
    for (const inv of DEMO.invoices) {
      const subtotal = sumLines(inv.lines);
      const taxAmount = round2(subtotal * taxRateNum);
      const discount = round2(inv.discount ?? 0);
      const total = round2(subtotal + taxAmount - discount);

      // Resolve each payment's intent against the running balance, so "pay the
      // rest" and "overpay by $50" stay true whatever the line items sum to.
      let running = 0;
      const payments = inv.payments.map((p) => {
        const amount =
          "amount" in p
            ? round2(p.amount)
            : "over" in p
              ? round2(total - running + p.over)
              : round2(total - running);
        running = round2(running + amount);
        return {
          amount,
          method: p.method,
          dayOffset: p.dayOffset,
          reference: "reference" in p ? p.reference : undefined,
        };
      });
      const amountPaid = running;

      const { balanceDue, creditAmount } = splitPayment({
        totalAmount: total,
        amountPaid,
      });

      // `void` is the only status a seed may assert; everything else follows
      // from the money. A never-sent document stays a draft.
      const base: InvoiceStatus = inv.void
        ? "void"
        : inv.sent
          ? "sent"
          : "draft";
      const status = deriveStatus({
        current: base,
        totalAmount: total,
        amountPaid,
      });

      const issuedDate = dayOffset(inv.issuedDayOffset, tz);
      const dueDate =
        inv.dueDayOffset !== undefined
          ? dayOffset(inv.dueDayOffset, tz)
          : dueDateFromTerms(issuedDate, DEMO.tenant.invoicePaymentTerms);

      const [invoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          customerId: customerId(inv.customer),
          jobId: inv.job !== undefined ? jobId(inv.job) : null,
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
          notes: inv.notes ?? null,
          createdAt: instantOffset(inv.issuedDayOffset, 11),
        })
        .returning({ id: invoices.id });

      if (!invoice) throw new Error("Failed to insert invoice");

      await tx.insert(invoiceLineItems).values(
        inv.lines.map((l, idx) => ({
          tenantId,
          invoiceId: invoice.id,
          catalogItemId: l.catalog ? (catalogByName.get(l.catalog) ?? null) : null,
          itemType: l.itemType,
          description: l.description,
          quantity: l.quantity.toFixed(2),
          unitPrice: money(l.unitPrice),
          sortOrder: idx,
        })),
      );
      track("invoice_line_items", inv.lines.length);

      if (payments.length > 0) {
        await tx.insert(invoicePayments).values(
          payments.map((p) => ({
            tenantId,
            invoiceId: invoice.id,
            amount: money(p.amount),
            paymentMethod: p.method,
            paymentDate: dayOffset(p.dayOffset, tz),
            referenceNumber: p.reference ?? null,
          })),
        );
        track("invoice_payments", payments.length);
      }
      track("invoices", 1);
    }

    /* 3k. Quotes. */
    for (const q of DEMO.quotes) {
      const subtotal = sumLines(q.lines);
      const taxAmount = round2(subtotal * taxRateNum);
      const total = round2(subtotal + taxAmount);

      const [quote] = await tx
        .insert(quotes)
        .values({
          tenantId,
          customerId: customerId(q.customer),
          quoteNumber: "", // issued by trg_quotes_auto_number
          status: q.status,
          issuedDate: dayOffset(q.issuedDayOffset, tz),
          expiryDate: dayOffset(q.issuedDayOffset + 30, tz),
          subtotal: money(subtotal),
          taxRate,
          taxAmount: money(taxAmount),
          totalAmount: money(total),
          notes: q.notes ?? null,
          // Only an accepted quote may point at a job.
          convertedToJobId:
            q.status === "accepted" && q.job !== undefined ? jobId(q.job) : null,
          declineReason: q.status === "declined" ? q.declineReason ?? null : null,
          createdAt: instantOffset(q.issuedDayOffset, 10),
        })
        .returning({ id: quotes.id });

      if (!quote) throw new Error("Failed to insert quote");

      await tx.insert(quoteLineItems).values(
        q.lines.map((l, idx) => ({
          tenantId,
          quoteId: quote.id,
          catalogItemId: l.catalog ? (catalogByName.get(l.catalog) ?? null) : null,
          itemType: l.itemType,
          description: l.description,
          quantity: l.quantity.toFixed(2),
          unitPrice: money(l.unitPrice),
          sortOrder: idx,
        })),
      );
      track("quote_line_items", q.lines.length);

      await tx.insert(quoteActivities).values({
        tenantId,
        quoteId: quote.id,
        type: "quote_created",
        description: `Quote drafted for ${DEMO.customers[q.customer]?.firstName ?? "customer"}`,
        performedBy: userId,
        createdAt: instantOffset(q.issuedDayOffset, 10),
      });
      track("quote_activities", 1);
      track("quotes", 1);
    }

    /* 3l. Bookings — the public portal's output. A booking that was converted
           carries the job link on BOTH sides; writing only one side is the
           BOOK-audit defect. */
    for (const b of DEMO.bookings) {
      const [booking] = await tx
        .insert(bookings)
        .values({
          tenantId,
          customerId: b.customer !== undefined ? customerId(b.customer) : null,
          customerName: b.customerName,
          customerEmail: b.customerEmail,
          customerPhone: b.customerPhone,
          serviceType: b.serviceType,
          bookingDate: dayOffset(b.dayOffset, tz),
          preferredTime: b.time,
          address: b.address,
          description: b.description,
          status: b.status,
          source: b.source,
          convertedToJobId: b.convertedJob !== undefined ? jobId(b.convertedJob) : null,
          createdAt: instantOffset(b.dayOffset - 2, 8),
        })
        .returning({ id: bookings.id });

      if (!booking) throw new Error("Failed to insert booking");

      if (b.convertedJob !== undefined) {
        await tx
          .update(jobs)
          .set({ bookingId: booking.id })
          .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId(b.convertedJob))));
      }

      await tx.insert(bookingActivities).values({
        tenantId,
        bookingId: booking.id,
        type: "booking_created",
        description: `Booking received from ${b.source}`,
        createdAt: instantOffset(b.dayOffset - 2, 8),
      });
      track("booking_activities", 1);
      track("bookings", 1);
    }

    /* 3m. Calendar events, contracts, day overrides, notifications. */
    const calendarValues = DEMO.calendarEvents.map((e) => ({
      tenantId,
      title: e.title,
      description: e.description,
      eventDate: dayOffset(e.dayOffset, tz),
      startTime: e.start,
      endTime: e.end,
      contactName: e.contactName ?? null,
      address: e.address ?? null,
      color: e.color,
    }));
    await tx.insert(calendarEvents).values(calendarValues);
    track("calendar_events", calendarValues.length);

    const contractValues = DEMO.contracts.map((c) => ({
      tenantId,
      customerId: customerId(c.customer),
      contractName: c.name,
      startDate: dayOffset(-c.startedDaysAgo, tz),
      endDate: dayOffset(c.endsInDays, tz),
      frequency: c.frequency,
      visitsPerYear: c.visitsPerYear,
      annualPrice: money(c.annualPrice),
      isActive: true,
      notes: c.notes ?? null,
    }));
    await tx.insert(maintenanceContracts).values(contractValues);
    track("maintenance_contracts", contractValues.length);

    const overrideValues = DEMO.dayOff.map((d) => ({
      tenantId,
      overrideDate: dayOffset(d.dayOffset, tz),
      isAvailable: false,
      reason: d.reason,
    }));
    await tx.insert(scheduleOverrides).values(overrideValues);
    track("schedule_overrides", overrideValues.length);

    const notificationValues = DEMO.notifications.map((n, i) => ({
      tenantId,
      type: n.type,
      title: n.title,
      description: n.description,
      actorId: userId,
      // dedup_key is uniquely indexed per tenant where not null; a stable,
      // distinct key per seeded row keeps --reset + reseed collision-free.
      dedupKey: `seed-${i}`,
      createdAt: instantOffset(-n.daysAgo, 13),
    }));
    await tx.insert(notifications).values(notificationValues);
    track("notifications", notificationValues.length);
  });

  console.log("\nSeeded:");
  for (const [table, n] of Object.entries(counts).sort()) {
    console.log(`  ${table.padEnd(28)} ${n}`);
  }
  console.log(`\nSign in as ${OWNER_EMAIL} to see it.`);

  await closeDb();
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  await closeDb().catch(() => {});
  process.exit(1);
});
