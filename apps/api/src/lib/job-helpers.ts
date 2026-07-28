import {
  getDb,
  checklistTemplates,
  checklistItems,
  jobChecklistCompletions,
  jobActivities,
  jobs,
  jobPhotos,
  jobDocuments,
  jobLineItems,
  invoices,
  customers,
  tenants,
  eq,
  and,
  asc,
  inArray,
} from "@hvac-saas/database";
import { deleteFiles } from "./storage.js";

/**
 * Auto-attach a checklist template to a job based on service type.
 * Finds the active template matching the service type, creates completion
 * entries for all items, and logs an activity.
 */
/** Accepts both the regular db client and transaction objects. */
export async function attachChecklistToJob(
  // Drizzle tx objects share the same query API but have a different type.
  // Widen to accept both by omitting the $client property check.
  db: Omit<ReturnType<typeof getDb>, "$client">,
  jobId: string,
  tenantId: string,
  // Was `string` + `as never` at the comparison. `serviceType` is a pgEnum, and
  // the Zod schema now mirrors it, so the real union flows through and the
  // suppression is unnecessary.
  serviceType: (typeof checklistTemplates.serviceType)["_"]["data"],
  userId: string,
) {
  // Find active template for this service type
  const template = await db
    .select()
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.tenantId, tenantId),
        eq(checklistTemplates.serviceType, serviceType),
        eq(checklistTemplates.isActive, true),
      ),
    )
    .then((r) => r[0]);

  if (!template) return;

  // Get template items
  const items = await db
    .select()
    .from(checklistItems)
    .where(
      and(
        eq(checklistItems.tenantId, tenantId),
        eq(checklistItems.templateId, template.id),
      ),
    )
    .orderBy(asc(checklistItems.sortOrder));

  if (items.length === 0) return;

  // Bulk insert completions
  await db.insert(jobChecklistCompletions).values(
    items.map((item) => ({
      tenantId,
      jobId,
      checklistItemId: item.id,
      isCompleted: false,
    })),
  );

  // Log activity
  await db.insert(jobActivities).values({
    tenantId,
    jobId,
    type: "checklist.attached",
    description: `Checklist "${template.name}" attached (${items.length} items)`,
    metadata: { templateId: template.id, templateName: template.name },
    performedBy: userId,
  });
}

/**
 * Delete every stored photo and document belonging to these jobs.
 *
 * `DELETE /jobs/:id` did this; `POST /jobs/bulk-delete` did not — it dropped the
 * rows and let the FK cascade take the records, leaving the objects in R2
 * forever, unreferenced and billable to nobody but us. Deleting five jobs one at
 * a time cleaned up; selecting the same five and using the bulk bar did not.
 *
 * Best-effort by design: `deleteFiles` never throws, so a storage outage cannot
 * block the database delete the user asked for.
 */
export async function deleteJobAttachments(
  db: Omit<ReturnType<typeof getDb>, "$client">,
  tenantId: string,
  jobIds: string[],
): Promise<number> {
  if (jobIds.length === 0) return 0;

  const [photos, docs] = await Promise.all([
    db
      .select({ storagePath: jobPhotos.storagePath })
      .from(jobPhotos)
      .where(
        and(eq(jobPhotos.tenantId, tenantId), inArray(jobPhotos.jobId, jobIds)),
      ),
    db
      .select({ storagePath: jobDocuments.storagePath })
      .from(jobDocuments)
      .where(
        and(
          eq(jobDocuments.tenantId, tenantId),
          inArray(jobDocuments.jobId, jobIds),
        ),
      ),
  ]);

  const paths = [...photos, ...docs].map((f) => f.storagePath);
  if (paths.length > 0) {
    await deleteFiles("job-attachments", paths);
  }
  return paths.length;
}

/**
 * How many invoices will lose their job link if these jobs are deleted.
 * `invoices.job_id` is ON DELETE SET NULL, so the invoice survives but silently
 * stops pointing at the work it bills for. Deletion is irreversible, so the
 * count belongs in the response rather than in nobody's hands.
 */
export async function countLinkedInvoices(
  db: Omit<ReturnType<typeof getDb>, "$client">,
  tenantId: string,
  jobIds: string[],
): Promise<number> {
  if (jobIds.length === 0) return 0;
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.jobId, jobIds)));
  return rows.length;
}

/**
 * E-05: send the job-completion email to the customer.
 *
 * Lived inline in `PATCH /jobs/:id/status`, so `POST /jobs/bulk-status-update`
 * sent nothing — completing ten jobs at once notified nobody, while completing
 * the same ten one at a time sent ten emails. Fire-and-forget by design: a mail
 * failure must not fail the status change the user asked for.
 */
export async function sendJobCompletionEmailFor(
  db: Omit<ReturnType<typeof getDb>, "$client">,
  tenantId: string,
  jobId: string,
): Promise<void> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));
  if (!job?.customerId) return;

  const [{ sendJobCompletionEmail }, { formatDateInTimezone }] =
    await Promise.all([import("./email.js"), import("./timezone.js")]);

  const [customer, tenant, lineItems] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(
        and(eq(customers.tenantId, tenantId), eq(customers.id, job.customerId)),
      )
      .then((r) => r[0]),
    db.select().from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]),
    db
      .select()
      .from(jobLineItems)
      .where(
        and(
          eq(jobLineItems.jobId, jobId),
          eq(jobLineItems.tenantId, tenantId),
        ),
      ),
  ]);

  if (!customer?.email) return;

  const subtotal = lineItems.reduce((sum, li) => sum + Number(li.total ?? 0), 0);
  const taxAmount = subtotal * Number(job.taxRate ?? 0);

  await sendJobCompletionEmail({
    to: customer.email,
    props: {
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      businessName: tenant?.businessName ?? "HVAC Service",
      businessLogoUrl: tenant?.logoUrl ?? null,
      businessPhone: tenant?.phone ?? null,
      businessAddress: tenant?.address ?? null,
      jobTitle: job.title ?? "Service",
      serviceType: job.serviceType ?? "General",
      completedDate: formatDateInTimezone(tenant?.timezone ?? "America/Chicago"),
      lineItems: lineItems.map((li) => ({
        description: li.description ?? "",
        quantity: Number(li.quantity ?? 1),
        unitPrice: Number(li.unitPrice ?? 0),
        total: Number(li.total ?? 0),
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      notes: job.description,
    },
  }).catch((err) =>
    console.error("[email] E-05 job completion failed:", err),
  );
}
