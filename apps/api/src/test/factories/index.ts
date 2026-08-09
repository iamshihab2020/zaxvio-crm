import { randomUUID } from "node:crypto";
import {
  customers,
  jobPipelineStages,
  jobs,
  member,
  organization,
  pipelines,
  tenants,
  user,
} from "@hvac-saas/database";
import type { TestDb } from "../db.js";

/**
 * Row builders for integration tests.
 *
 * Two rules:
 *
 * 1. **Everything takes the `db` handle**, so a factory works inside
 *    `withRollback`'s transaction. A factory that reached for `getDb()` itself
 *    would commit and defeat the whole harness.
 *
 * 2. **Every value is unique per call.** Tests run serially against a shared
 *    database, and a hardcoded slug or email collides with a unique index the
 *    second time a suite runs. `uniq()` is the whole mechanism.
 *
 * Nothing here asserts. A factory that validates its own output is a test that
 * passes because the factory agreed with itself.
 */

let counter = 0;
function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenancy
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantFixture {
  tenantId: string;
  organizationId: string;
  ownerUserId: string;
  timezone: string;
}

/**
 * A tenant, its Better Auth organization, an owner user and the membership
 * linking them — which is the minimum a `requireTenant` code path can resolve.
 *
 * Most cross-tenant tests create two of these and assert that work scoped to
 * one cannot see the other. That assertion is load-bearing here in a way it is
 * not in the system this was ported from: there is no row-level security
 * underneath, so the application is the only boundary.
 */
export async function createTenant(
  db: TestDb,
  overrides: { businessName?: string; timezone?: string } = {},
): Promise<TenantFixture> {
  const organizationId = uniq("org");
  const userId = uniq("usr");
  const timezone = overrides.timezone ?? "America/Chicago";

  await db.insert(organization).values({
    id: organizationId,
    name: overrides.businessName ?? "Test Business",
    slug: uniq("slug"),
  });

  await db.insert(user).values({
    id: userId,
    name: "Test Owner",
    email: `${uniq("owner")}@example.test`,
    emailVerified: true,
  });

  await db.insert(member).values({
    id: uniq("mbr"),
    organizationId,
    userId,
    role: "owner",
  });

  const [tenant] = await db
    .insert(tenants)
    .values({
      organizationId,
      businessName: overrides.businessName ?? "Test Business",
      ownerName: "Test Owner",
      email: `${uniq("biz")}@example.test`,
      slug: uniq("tenant"),
      timezone,
    })
    .returning({ id: tenants.id });

  return { tenantId: tenant.id, organizationId, ownerUserId: userId, timezone };
}

/** An extra team member on an existing tenant. */
export async function createMember(
  db: TestDb,
  fixture: TenantFixture,
  overrides: { role?: string; name?: string } = {},
): Promise<{ userId: string }> {
  const userId = uniq("usr");
  await db.insert(user).values({
    id: userId,
    name: overrides.name ?? "Test Technician",
    email: `${uniq("member")}@example.test`,
    emailVerified: true,
  });
  await db.insert(member).values({
    id: uniq("mbr"),
    organizationId: fixture.organizationId,
    userId,
    role: overrides.role ?? "member",
  });
  return { userId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain records
// ─────────────────────────────────────────────────────────────────────────────

export async function createCustomer(
  db: TestDb,
  tenantId: string,
  overrides: Partial<typeof customers.$inferInsert> = {},
): Promise<{ id: string; email: string }> {
  const email = overrides.email ?? `${uniq("cust")}@example.test`;
  const [row] = await db
    .insert(customers)
    .values({
      tenantId,
      firstName: "Dana",
      lastName: "Rivera",
      phone: "+13125550148",
      ...overrides,
      email,
    })
    .returning({ id: customers.id });
  return { id: row.id, email };
}

export interface PipelineFixture {
  pipelineId: string;
  /** Keyed by lifecycle, so a test can say "move it to the completed stage"
   *  without caring what the tenant named that column. */
  stages: Record<"scheduled" | "in_progress" | "completed" | "cancelled", string>;
}

/**
 * A pipeline with one stage per lifecycle.
 *
 * `lifecycle` is the four-value truth the rest of the system reasons about,
 * while `name`/`label` are whatever the tenant called the column. Tests that
 * assert on stage transitions must key on the lifecycle, because a filter that
 * matches on the label is the bug — a renamed column would silently stop it
 * matching.
 */
export async function createPipeline(
  db: TestDb,
  tenantId: string,
  overrides: { name?: string; label?: string; isDefault?: boolean } = {},
): Promise<PipelineFixture> {
  // `name` is unique per tenant, so it has to vary per call — several tests
  // build two pipelines on one tenant. `label` is what a user reads.
  const label = overrides.label ?? "Installations";
  const [pipeline] = await db
    .insert(pipelines)
    .values({
      tenantId,
      name: overrides.name ?? uniq("pipeline"),
      label,
      isDefault: overrides.isDefault ?? true,
    })
    .returning({ id: pipelines.id });

  const definitions = [
    { name: "scheduled", label: "Scheduled", lifecycle: "scheduled" as const, sortOrder: 0 },
    { name: "on_site", label: "On site", lifecycle: "in_progress" as const, sortOrder: 1 },
    { name: "done", label: "Done", lifecycle: "completed" as const, sortOrder: 2 },
    { name: "dropped", label: "Dropped", lifecycle: "cancelled" as const, sortOrder: 3 },
  ];

  const rows = await db
    .insert(jobPipelineStages)
    .values(
      definitions.map((d) => ({
        tenantId,
        pipelineId: pipeline.id,
        name: d.name,
        label: d.label,
        lifecycle: d.lifecycle,
        sortOrder: d.sortOrder,
        isDefault: d.sortOrder === 0,
      })),
    )
    .returning({ id: jobPipelineStages.id, lifecycle: jobPipelineStages.lifecycle });

  const stages = {} as PipelineFixture["stages"];
  for (const row of rows) stages[row.lifecycle] = row.id;

  return { pipelineId: pipeline.id, stages };
}

export async function createJob(
  db: TestDb,
  args: {
    tenantId: string;
    customerId: string;
    pipeline?: PipelineFixture;
    overrides?: Partial<typeof jobs.$inferInsert>;
  },
): Promise<{ id: string; jobNumber: string }> {
  const { tenantId, customerId, pipeline, overrides } = args;

  const [row] = await db
    .insert(jobs)
    .values({
      tenantId,
      customerId,
      pipelineId: pipeline?.pipelineId ?? null,
      stageId: pipeline?.stages.scheduled ?? null,
      // Left to the trigger in production; tests run inside a rolled-back
      // transaction where the sequence would still advance, so a unique literal
      // keeps runs independent without burning numbers.
      jobNumber: uniq("JOB").toUpperCase(),
      status: "scheduled",
      serviceType: "maintenance",
      title: "Annual service",
      scheduledDate: "2026-11-02",
      ...overrides,
    })
    .returning({ id: jobs.id, jobNumber: jobs.jobNumber });

  return { id: row.id, jobNumber: row.jobNumber };
}

/**
 * A whole tenant with one customer, one pipeline and one job — the shape most
 * engine tests want, in one call.
 */
export async function createWorkspace(db: TestDb): Promise<
  TenantFixture & {
    customerId: string;
    pipeline: PipelineFixture;
    jobId: string;
  }
> {
  const tenant = await createTenant(db);
  const customer = await createCustomer(db, tenant.tenantId);
  const pipeline = await createPipeline(db, tenant.tenantId);
  const job = await createJob(db, {
    tenantId: tenant.tenantId,
    customerId: customer.id,
    pipeline,
  });
  return { ...tenant, customerId: customer.id, pipeline, jobId: job.id };
}

/** A uuid that belongs to nobody. For "this id is not yours" assertions. */
export function foreignId(): string {
  return randomUUID();
}
