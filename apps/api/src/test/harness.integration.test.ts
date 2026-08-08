import { beforeAll, describe, expect, it } from "vitest";
import { customers, eq, getDb, and } from "@hvac-saas/database";
import { requireDatabase } from "./setup.js";
import { withRollback } from "./db.js";
import { createCustomer, createTenant, createWorkspace } from "./factories/index.js";

/**
 * Proves the harness itself before anything relies on it.
 *
 * If `withRollback` leaked even one row, every later integration test would be
 * accumulating state and the suite would pass locally and fail on the next run.
 * That failure mode is quiet and expensive, so it gets its own test.
 */

beforeAll(() => {
  requireDatabase();
});

describe("withRollback", () => {
  it("writes real rows inside the transaction", async () => {
    const seen = await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId, { firstName: "Rollback" });

      const [row] = await db
        .select({ id: customers.id, firstName: customers.firstName })
        .from(customers)
        .where(
          and(eq(customers.tenantId, tenant.tenantId), eq(customers.id, customer.id)),
        );

      return { customerId: customer.id, firstName: row?.firstName };
    });

    expect(seen.firstName).toBe("Rollback");
    expect(seen.customerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("leaves nothing behind", async () => {
    const { customerId } = await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      return { customerId: customer.id };
    });

    // Outside the transaction now — a real committed read.
    const rows = await getDb()
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customerId));

    expect(rows).toEqual([]);
  });

  it("re-throws the body's error, not the rollback signal", async () => {
    // Getting this wrong is subtle and awful: every failing test would report
    // "test rollback" instead of the actual assertion failure.
    await expect(
      withRollback(async () => {
        throw new Error("the real failure");
      }),
    ).rejects.toThrow("the real failure");
  });

  it("still rolls back when the body throws", async () => {
    let leaked: string | undefined;

    await expect(
      withRollback(async (db) => {
        const tenant = await createTenant(db);
        const customer = await createCustomer(db, tenant.tenantId);
        leaked = customer.id;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(leaked).toBeDefined();
    const rows = await getDb()
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, leaked!));
    expect(rows).toEqual([]);
  });
});

describe("factories", () => {
  it("build a workspace whose stages are keyed by lifecycle", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      expect(ws.tenantId).toBeTruthy();
      expect(ws.customerId).toBeTruthy();
      expect(ws.jobId).toBeTruthy();

      // A tenant can name a stage anything; `lifecycle` is what the rest of the
      // system reasons about, and it is what tests must key on.
      expect(Object.keys(ws.pipeline.stages).sort()).toEqual([
        "cancelled",
        "completed",
        "in_progress",
        "scheduled",
      ]);
      for (const id of Object.values(ws.pipeline.stages)) {
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
      }
    });
  });

  it("produce independent tenants", async () => {
    await withRollback(async (db) => {
      const a = await createTenant(db);
      const b = await createTenant(db);
      expect(a.tenantId).not.toBe(b.tenantId);
      expect(a.organizationId).not.toBe(b.organizationId);

      // The shape every cross-tenant assertion is built on: B's customer is
      // invisible to a query scoped to A.
      const customerB = await createCustomer(db, b.tenantId);
      const visibleToA = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, a.tenantId), eq(customers.id, customerB.id)));

      expect(visibleToA).toEqual([]);
    });
  });
});
