import { afterEach, describe, expect, it } from "vitest";
import {
  getDb,
  workflowEventQueue,
  and,
  eq,
  inArray,
  sql,
} from "@hvac-saas/database";
import {
  buildEventFixture,
  QUEUE_SETTINGS,
  backoffMs,
} from "@hvac-saas/workflow-nodes";

import { requireDatabase } from "./setup.js";
import { withCleanup, withRollback, type TestDb } from "./db.js";
import { createTenant, createCustomer } from "./factories/index.js";
import { emitWorkflowEvent } from "../services/workflow/events/emit.js";
import {
  claimEvents,
  clearSubscribers,
  recoverStaleEvents,
  registerSubscriber,
  tick,
} from "../services/workflow/events/worker.js";

/**
 * The outbox, proven by execution — docs/workflow-automation/wf-06 §6.3.
 *
 * Every claim in the design document that could be wrong is asserted here
 * against real Postgres: the transactional guarantee, the per-subscriber
 * isolation, the dedup index, the claim under concurrency, the backoff, the
 * dead letter and the stale sweep. A queue whose properties are only argued for
 * in prose is a queue whose properties are unknown.
 */

requireDatabase();

afterEach(() => {
  clearSubscribers();
});

/** The rows one emit produced, ordered so assertions are stable. */
async function rowsFor(db: TestDb, correlationId: string) {
  return db
    .select()
    .from(workflowEventQueue)
    .where(eq(workflowEventQueue.correlationId, correlationId))
    .orderBy(workflowEventQueue.subscriber);
}

describe("emit — the transactional guarantee", () => {
  it("writes one row per subscriber, both pending, sharing a correlation id", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);

      const result = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: tenant.ownerUserId,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      expect(result.enqueued).toBe(2);
      expect(result.deduped).toBe(false);

      const rows = await rowsFor(db, result.correlationId);
      expect(rows.map((r) => r.subscriber)).toEqual(["goal_listener", "workflow_trigger"]);
      for (const row of rows) {
        expect(row.status).toBe("pending");
        expect(row.attempts).toBe(0);
        expect(row.maxAttempts).toBe(QUEUE_SETTINGS.MAX_ATTEMPTS);
        expect(row.eventType).toBe("customer.created");
        expect(row.subjectType).toBe("customer");
        expect(row.subjectId).toBe(customer.id);
        expect(row.tenantId).toBe(tenant.tenantId);
      }
    });
  });

  it("leaves NO queue row when the domain write rolls back", async () => {
    // The single property that makes this an outbox rather than a queue with
    // extra steps. If it fails, an automation can fire for work that never
    // happened.
    const db = getDb();
    let correlationId = "";
    let tenantId = "";

    await withRollback(async (tx) => {
      const tenant = await createTenant(tx);
      tenantId = tenant.tenantId;
      const customer = await createCustomer(tx, tenant.tenantId);
      const result = await emitWorkflowEvent(tx, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });
      correlationId = result.correlationId;
      // Inside the transaction the row is visible…
      expect(await rowsFor(tx, correlationId)).toHaveLength(2);
    });

    // …and after the rollback it is not, on a fresh read outside it.
    const after = await db
      .select({ id: workflowEventQueue.id })
      .from(workflowEventQueue)
      .where(eq(workflowEventQueue.correlationId, correlationId));
    expect(after).toHaveLength(0);
    expect(tenantId).not.toBe("");
  });

  it("refuses an invalid payload before writing anything", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);

      await expect(
        emitWorkflowEvent(db, {
          type: "customer.created",
          tenantId: tenant.tenantId,
          subject: { type: "customer", id: customer.id },
          actorUserId: null,
          payload: {
            ...buildEventFixture("customer.created", { customerId: customer.id }),
            // @ts-expect-error - not a member of the source enum, which is the
            // assertion: the payload parse must reject it at runtime too.
            source: "telepathy",
          },
        }),
      ).rejects.toThrow();

      // Nothing was written for this tenant — the parse runs before the insert.
      const rows = await db
        .select({ id: workflowEventQueue.id })
        .from(workflowEventQueue)
        .where(eq(workflowEventQueue.tenantId, tenant.tenantId));
      expect(rows).toHaveLength(0);
    });
  });

  it("refuses a subject that disagrees with the registry", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);

      // `customer.created` is about a customer. Enqueuing it against a job
      // would produce a run whose loader looks in the wrong table.
      await expect(
        emitWorkflowEvent(db, {
          type: "customer.created",
          tenantId: tenant.tenantId,
          subject: { type: "job", id: customer.id },
          actorUserId: null,
          payload: buildEventFixture("customer.created", { customerId: customer.id }),
        }),
      ).rejects.toThrow(/about a customer/);

      // And a subject-less event must not be given one.
      await expect(
        emitWorkflowEvent(db, {
          type: "schedule.daily",
          tenantId: tenant.tenantId,
          subject: { type: "customer", id: customer.id },
          actorUserId: null,
          payload: buildEventFixture("schedule.daily"),
        }),
      ).rejects.toThrow(/no subject/);
    });
  });

  it("enqueues once when a producer fires twice with the same dedup key", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const payload = buildEventFixture("customer.created", { customerId: customer.id });
      const dedupKey = `test:${customer.id}`;

      const first = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload,
        dedupKey,
      });
      const second = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload,
        dedupKey,
      });

      expect(first.enqueued).toBe(2);
      expect(second.enqueued).toBe(0);
      expect(second.deduped).toBe(true);

      // Still exactly one pair — and crucially the transaction is still usable
      // afterwards, which a caught 23505 would not leave it.
      const all = await db
        .select({ id: workflowEventQueue.id })
        .from(workflowEventQueue)
        .where(eq(workflowEventQueue.dedupKey, dedupKey));
      expect(all).toHaveLength(2);
    });
  });

  it("lets two different events with no dedup key coexist", async () => {
    // A partial unique index must not collapse NULLs.
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const payload = buildEventFixture("customer.created", { customerId: customer.id });

      const a = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload,
      });
      const b = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload,
      });

      expect(a.enqueued).toBe(2);
      expect(b.enqueued).toBe(2);
      expect(a.correlationId).not.toBe(b.correlationId);
    });
  });
});

describe("claiming", () => {
  it("claims only due rows and marks them processing", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const payload = buildEventFixture("customer.created", { customerId: customer.id });

      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload,
      });

      // A row scheduled into the future must not be claimed.
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const scheduled = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload,
        scheduledAt: future,
      });

      const claimed = await claimEvents(db, 50);
      const mine = claimed.filter((c) => c.correlationId === correlationId);
      const notMine = claimed.filter((c) => c.correlationId === scheduled.correlationId);

      expect(mine).toHaveLength(2);
      expect(notMine).toHaveLength(0);
      for (const row of mine) {
        expect(row.attempts).toBe(1);
        expect(row.tenantId).toBe(tenant.tenantId);
      }

      const after = await rowsFor(db, correlationId);
      for (const row of after) {
        expect(row.status).toBe("processing");
        expect(row.claimedAt).not.toBeNull();
      }
    });
  });

  it("does not claim a row whose backoff has not elapsed", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      await db
        .update(workflowEventQueue)
        .set({ nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) })
        .where(eq(workflowEventQueue.correlationId, correlationId));

      const claimed = await claimEvents(db, 50);
      expect(claimed.filter((c) => c.correlationId === correlationId)).toHaveLength(0);

      // Move the retry into the past and it becomes eligible again.
      await db
        .update(workflowEventQueue)
        .set({ nextRetryAt: new Date(Date.now() - 1000) })
        .where(eq(workflowEventQueue.correlationId, correlationId));

      const retried = await claimEvents(db, 50);
      expect(retried.filter((c) => c.correlationId === correlationId)).toHaveLength(2);
    });
  });

  it("two concurrent workers split 20 rows with zero double-processing", async () => {
    // The property `SELECT` + `UPDATE` cannot give you. Needs committed rows and
    // two real connections, so this is the one test that cleans up after itself
    // instead of rolling back.
    await withCleanup(async (db, onCleanup) => {
      const tenant = await createTenant(db);
      onCleanup(async () => {
        // Order matters: the queue rows cascade off the tenant, but the tenant
        // itself is what the organization and user hang from.
        await db.execute(sql`DELETE FROM tenants WHERE id = ${tenant.tenantId}`);
        await db.execute(sql`DELETE FROM "member" WHERE user_id = ${tenant.ownerUserId}`);
        await db.execute(sql`DELETE FROM "user" WHERE id = ${tenant.ownerUserId}`);
        await db.execute(
          sql`DELETE FROM organization WHERE id = ${tenant.organizationId}`,
        );
      });
      const customer = await createCustomer(db, tenant.tenantId);
      const payload = buildEventFixture("customer.created", { customerId: customer.id });

      const correlationIds: string[] = [];
      // 10 emits × 2 subscribers = 20 rows.
      for (let i = 0; i < 10; i++) {
        const r = await emitWorkflowEvent(db, {
          type: "customer.created",
          tenantId: tenant.tenantId,
          subject: { type: "customer", id: customer.id },
          actorUserId: null,
          payload,
          dedupKey: `concurrency:${customer.id}:${i}`,
        });
        correlationIds.push(r.correlationId);
      }
      onCleanup(async () => {
        await db
          .delete(workflowEventQueue)
          .where(inArray(workflowEventQueue.correlationId, correlationIds));
      });

      const before = await db
        .select({ id: workflowEventQueue.id })
        .from(workflowEventQueue)
        .where(inArray(workflowEventQueue.correlationId, correlationIds));
      expect(before).toHaveLength(20);

      // Both claims start before either finishes.
      const [a, b] = await Promise.all([claimEvents(db, 20), claimEvents(db, 20)]);

      const mineA = a.filter((r) => correlationIds.includes(r.correlationId));
      const mineB = b.filter((r) => correlationIds.includes(r.correlationId));
      const ids = [...mineA, ...mineB].map((r) => r.id);

      // Every row claimed exactly once, by exactly one of them.
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(20);

      const attempts = await db
        .select({ attempts: workflowEventQueue.attempts })
        .from(workflowEventQueue)
        .where(inArray(workflowEventQueue.correlationId, correlationIds));
      // A row claimed twice would show 2.
      expect(attempts.every((r) => r.attempts === 1)).toBe(true);
    });
  });
});

describe("processing", () => {
  it("completes a row when its subscriber returns", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const seen: string[] = [];
      registerSubscriber("workflow_trigger", async (event) => {
        seen.push(event.eventType);
      });

      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      const result = await tick(db);
      expect(result.claimed).toBeGreaterThanOrEqual(2);
      expect(seen).toContain("customer.created");

      const rows = await rowsFor(db, correlationId);
      for (const row of rows) {
        expect(row.status).toBe("completed");
        expect(row.processedAt).not.toBeNull();
      }
    });
  });

  it("a failing subscriber does not retry the other one", async () => {
    // B-07: the reference implementation ran nine concerns in one handler, so a
    // throw in the seventh retried the first — an automation re-ran because
    // nurture enrollment had failed.
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      let triggerCalls = 0;

      registerSubscriber("workflow_trigger", async () => {
        triggerCalls += 1;
      });
      registerSubscriber("goal_listener", async () => {
        throw new Error("goal listener is broken");
      });

      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      const result = await tick(db);
      expect(result.retrying).toBeGreaterThanOrEqual(1);

      const rows = await rowsFor(db, correlationId);
      const goal = rows.find((r) => r.subscriber === "goal_listener")!;
      const trigger = rows.find((r) => r.subscriber === "workflow_trigger")!;

      expect(trigger.status).toBe("completed");
      expect(goal.status).toBe("pending");
      expect(goal.lastError).toContain("goal listener is broken");
      expect(goal.nextRetryAt).not.toBeNull();

      // The successful one is not re-run by the failure of the other.
      await tick(db);
      expect(triggerCalls).toBe(1);
    });
  });

  it("backs off, then dead-letters when the attempts are spent", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      registerSubscriber("workflow_trigger", async () => {
        throw new Error("always fails");
      });
      registerSubscriber("goal_listener", async () => {
        throw new Error("always fails");
      });

      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      for (let attempt = 1; attempt <= QUEUE_SETTINGS.MAX_ATTEMPTS; attempt++) {
        // Make the row eligible again without waiting out a real backoff.
        await db
          .update(workflowEventQueue)
          .set({ nextRetryAt: new Date(Date.now() - 1000) })
          .where(
            and(
              eq(workflowEventQueue.correlationId, correlationId),
              eq(workflowEventQueue.status, "pending"),
            ),
          );
        await tick(db);

        const rows = await rowsFor(db, correlationId);
        const expected = attempt < QUEUE_SETTINGS.MAX_ATTEMPTS ? "pending" : "failed";
        for (const row of rows) {
          expect(row.attempts, `after attempt ${attempt}`).toBe(attempt);
          expect(row.status, `after attempt ${attempt}`).toBe(expected);
        }
      }

      // Dead letters are not claimed again — that is what makes them a floor
      // rather than an infinite retry with extra logging.
      const claimed = await claimEvents(db, 50);
      expect(claimed.filter((c) => c.correlationId === correlationId)).toHaveLength(0);
    });
  });

  it("dead-letters an unparseable payload immediately, without burning retries", async () => {
    // The deploy case: a payload shape changed while rows were queued. Retrying
    // would take five attempts and eight minutes to reach the same answer.
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      // Corrupt it in place, exactly as a schema change would.
      await db
        .update(workflowEventQueue)
        .set({ payload: { nowCompletelyWrong: true } })
        .where(eq(workflowEventQueue.correlationId, correlationId));

      const result = await tick(db);
      expect(result.unprocessable).toBeGreaterThanOrEqual(2);

      const rows = await rowsFor(db, correlationId);
      for (const row of rows) {
        expect(row.status).toBe("failed");
        expect(row.attempts).toBe(1);
        expect(row.lastError).toContain("unprocessable");
      }
    });
  });

  it("completes rather than dead-letters when no subscriber is registered", async () => {
    // P2 ships before the engine. A subscriber with nothing to do must not fill
    // the dead-letter queue with rows describing an unbuilt feature.
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      await tick(db);

      const rows = await rowsFor(db, correlationId);
      expect(rows.every((r) => r.status === "completed")).toBe(true);
    });
  });
});

describe("recovery", () => {
  it("returns rows abandoned in processing, without decrementing attempts", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      await claimEvents(db, 50);

      // A process that died would leave `claimed_at` where it was.
      const longAgo = new Date(Date.now() - QUEUE_SETTINGS.STALE_PROCESSING_MS - 60_000);
      await db
        .update(workflowEventQueue)
        .set({ claimedAt: longAgo })
        .where(eq(workflowEventQueue.correlationId, correlationId));

      const recovered = await recoverStaleEvents(db);
      expect(recovered).toBeGreaterThanOrEqual(2);

      const rows = await rowsFor(db, correlationId);
      for (const row of rows) {
        expect(row.status).toBe("pending");
        expect(row.claimedAt).toBeNull();
        // The attempt happened. A crash that repeats deterministically must
        // still exhaust its retries rather than loop for ever.
        expect(row.attempts).toBe(1);
      }
    });
  });

  it("leaves a freshly claimed row alone", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const { correlationId } = await emitWorkflowEvent(db, {
        type: "customer.created",
        tenantId: tenant.tenantId,
        subject: { type: "customer", id: customer.id },
        actorUserId: null,
        payload: buildEventFixture("customer.created", { customerId: customer.id }),
      });

      await claimEvents(db, 50);
      await recoverStaleEvents(db);

      const rows = await rowsFor(db, correlationId);
      expect(rows.every((r) => r.status === "processing")).toBe(true);
    });
  });
});

describe("backoff schedule", () => {
  it("is 30s, 1m, 2m, 4m, 8m and then caps", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(4)).toBe(240_000);
    expect(backoffMs(5)).toBe(480_000);
    // Never grows past the cap, however many attempts a future config allows.
    expect(backoffMs(9)).toBe(QUEUE_SETTINGS.BACKOFF_MAX_MS);
  });
});
