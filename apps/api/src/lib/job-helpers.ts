import {
  getDb,
  checklistTemplates,
  checklistItems,
  jobChecklistCompletions,
  jobActivities,
  eq,
  and,
  asc,
} from "@hvac-saas/database";

/**
 * Auto-attach a checklist template to a job based on service type.
 * Finds the active template matching the service type, creates completion
 * entries for all items, and logs an activity.
 */
export async function attachChecklistToJob(
  db: ReturnType<typeof getDb>,
  jobId: string,
  tenantId: string,
  serviceType: string,
  userId: string,
) {
  // Find active template for this service type
  const template = await db
    .select()
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.tenantId, tenantId),
        eq(checklistTemplates.serviceType, serviceType as never),
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
