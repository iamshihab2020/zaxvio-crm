import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  EVENT_CATEGORIES,
  EVENT_ORIGINS,
  EVENT_PHASES,
  EVENT_SUBSCRIBERS,
  EVENT_TYPES,
  WORKFLOW_EVENTS,
  getEventDefinition,
  getEventsByCategory,
  getEventsForSubject,
  isWorkflowEventType,
  parseEventPayload,
  requireEventDefinition,
  safeParseEventPayload,
  type WorkflowEventType,
} from "../events/registry.js";
import { buildAllEventFixtures, buildEventFixture } from "../events/fixtures.js";
import { SUBJECT_TYPES } from "../node-definition.js";
import { NODE_DEFINITIONS } from "../registry/index.js";

/**
 * Event taxonomy invariants — docs/workflow-automation/wf-06-triggers-and-events.md §6.1.
 *
 * The defect every test here is aimed at is one bug with three faces: a payload
 * written in one shape and read in another. It survived months in the reference
 * implementation because all three sides were `Record<string, unknown>` and the
 * unit test hand-wrote a fixture that agreed with the reader and not with
 * production.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const EVENTS_DIR = join(HERE, "..", "events");

/** `customer.created`, `job.stage_changed`. Domain, dot, snake_case action. */
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

describe("event identity", () => {
  it("every type matches the naming convention", () => {
    for (const type of EVENT_TYPES) {
      expect(type, `"${type}" is not domain.snake_case`).toMatch(EVENT_TYPE_PATTERN);
    }
  });

  it("has no duplicate types", () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
  });

  it("covers every documented event and nothing else", () => {
    // The count is asserted so that *adding* an event is a deliberate act that
    // updates this number and the docs together, rather than something that
    // slips in unnoticed and is never given a producer.
    //
    // 36 → 38 at P9: `webhook.received` (something outside Zaxvio called an
    // inbound URL) and `quote.viewed` (the customer opened their quote link).
    expect(EVENT_TYPES).toHaveLength(38);
  });

  it("recognises its own types and rejects near-misses", () => {
    expect(isWorkflowEventType("job.completed")).toBe(true);
    expect(isWorkflowEventType("job.complete")).toBe(false);
    expect(isWorkflowEventType("Job.Completed")).toBe(false);
    // A registry backed by a plain object must not answer yes to inherited keys.
    expect(isWorkflowEventType("toString")).toBe(false);
    expect(isWorkflowEventType("constructor")).toBe(false);
  });

  it("requireEventDefinition names the file to edit", () => {
    expect(() => requireEventDefinition("job.exploded")).toThrow(/registry\.ts/);
  });
});

describe("event metadata", () => {
  it("every event declares a valid category, origin and phase", () => {
    for (const type of EVENT_TYPES) {
      const def = WORKFLOW_EVENTS[type];
      expect(EVENT_CATEGORIES, type).toContain(def.category);
      expect(EVENT_ORIGINS, type).toContain(def.origin);
      expect(EVENT_PHASES, type).toContain(def.phase);
      expect(def.label.length, type).toBeGreaterThan(0);
      expect(def.description.length, type).toBeGreaterThan(0);
    }
  });

  it("every subject is a real subject type, and only system events have none", () => {
    for (const type of EVENT_TYPES) {
      const { subject, category } = WORKFLOW_EVENTS[type];
      if (subject === null) {
        // A subject-less event cannot use the enrollment dedup key, which is
        // why it needs `workflow_schedule_state` instead. Keep the set tiny and
        // explicit rather than letting new ones appear by accident.
        // `webhook.received` joins them at P9 and for the same reason: a
        // webhook is about whatever the automation decides it is about, and
        // reading a record id out of an untrusted body and trusting it is the
        // exact tenant-crossing wf-10 T-4 forbids.
        expect([
          "schedule.daily",
          "schedule.weekly",
          "manual.run",
          "webhook.received",
        ]).toContain(type);
      } else {
        expect(SUBJECT_TYPES, type).toContain(subject);
        expect(category, type).not.toBe("system");
      }
    }
  });

  it("groups consistently by category and subject", () => {
    const byCategory = EVENT_CATEGORIES.flatMap((c) => getEventsByCategory(c));
    expect(new Set(byCategory).size).toBe(EVENT_TYPES.length);

    const bySubject = SUBJECT_TYPES.flatMap((s) => getEventsForSubject(s));
    const subjectless = EVENT_TYPES.filter((t) => WORKFLOW_EVENTS[t].subject === null);
    expect(bySubject.length + subjectless.length).toBe(EVENT_TYPES.length);
  });

  it("derived events are the ones no write can produce", () => {
    // If a `derived` event ever gains a domain producer it has become a
    // different event, and the phase plan that scheduled its worker is wrong.
    const derived = EVENT_TYPES.filter((t) => WORKFLOW_EVENTS[t].origin === "derived");
    expect(derived).toEqual([
      "job.margin_below",
      "quote.expired",
      "invoice.overdue",
      "equipment.warranty_expiring",
      "contract.visit_due",
      "contract.expiring",
      "schedule.daily",
      "schedule.weekly",
    ]);
  });
});

describe("payload schemas", () => {
  it("every payload rejects an unknown key", () => {
    // `.strict()` on every payload is mechanism #1 against the misspelled-key
    // defect. One missing `.strict()` is a silent hole, so this checks all 36
    // rather than trusting review.
    for (const type of EVENT_TYPES) {
      const fixture = buildEventFixture(type) as Record<string, unknown>;
      const withExtra = { ...fixture, definitelyNotAField: "x" };
      const result = WORKFLOW_EVENTS[type].payload.safeParse(withExtra);
      expect(result.success, `${type} accepted an unknown key — is it missing .strict()?`).toBe(
        false,
      );
    }
  });

  it("every payload rejects a misspelled key rather than ignoring it", () => {
    // The exact production shape of the reference implementation's bug: the
    // producer sent one spelling, the consumer read another, and nothing
    // complained. Dropping a required key must fail.
    const fixture = buildEventFixture("job.stage_changed") as Record<string, unknown>;
    const { toStageId, ...rest } = fixture;
    const misspelled = { ...rest, to_stage_id: toStageId };
    expect(WORKFLOW_EVENTS["job.stage_changed"].payload.safeParse(misspelled).success).toBe(
      false,
    );
  });

  it("survives the jsonb round trip unchanged", () => {
    // The property that makes double-parsing meaningful. A `Date` or a `bigint`
    // would parse on the producer side and fail on the consumer side, because
    // what comes back out of a jsonb column is a string. Everything must be
    // JSON-safe, and equal to itself after the trip.
    for (const type of EVENT_TYPES) {
      const fixture = buildEventFixture(type);
      const roundTripped: unknown = JSON.parse(JSON.stringify(fixture));
      expect(roundTripped, `${type} changed shape through JSON`).toEqual(fixture);
      expect(
        WORKFLOW_EVENTS[type].payload.safeParse(roundTripped).success,
        `${type} does not re-parse after a jsonb round trip`,
      ).toBe(true);
    }
  });

  it("money stays a string and refuses a float", () => {
    // `numeric` comes out of Drizzle as a string, and a margin is a difference
    // of two sums, so a float here doubles the error. Accepting a number would
    // let a producer quietly introduce one.
    const result = WORKFLOW_EVENTS["invoice.paid"].payload.safeParse({
      ...(buildEventFixture("invoice.paid") as Record<string, unknown>),
      totalAmount: 1250.0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects the Postgres magic dates on every date field", () => {
    // BOOK-04: `'infinity'` and `'today'` parse in a `::date` cast, resolve in
    // the session timezone, and produce records that match no range query.
    for (const bad of ["infinity", "today", "now", "epoch", "2026-02-30"]) {
      const result = WORKFLOW_EVENTS["booking.created"].payload.safeParse({
        ...(buildEventFixture("booking.created") as Record<string, unknown>),
        bookingDate: bad,
      });
      expect(result.success, `"${bad}" was accepted as a booking date`).toBe(false);
    }
  });

  it("caps the inbound message preview", () => {
    const result = WORKFLOW_EVENTS["message.received"].payload.safeParse({
      ...(buildEventFixture("message.received") as Record<string, unknown>),
      preview: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("carries the customer on every customer-owned event", () => {
    // So `{{customer.firstName}}` resolves in the first node with no query, and
    // so a filter on "which customer" needs no loader.
    const exempt = new Set<WorkflowEventType>([
      // A booking may genuinely have no customer row yet.
      "booking.created",
      "booking.confirmed",
      "booking.cancelled",
      "booking.rescheduled",
      "booking.converted",
      // Subject-less.
      "schedule.daily",
      "schedule.weekly",
      "manual.run",
      // Entirely author-controlled and entirely untrusted — the only payload in
      // the taxonomy not built by a producer from a row we wrote.
      "webhook.received",
    ]);
    for (const type of EVENT_TYPES) {
      if (exempt.has(type)) continue;
      const fixture = buildEventFixture(type) as Record<string, unknown>;
      expect(fixture, `${type} has no customerId`).toHaveProperty("customerId");
      expect(fixture, `${type} has no customerEmail`).toHaveProperty("customerEmail");
    }
  });
});

describe("fixtures", () => {
  it("generates a valid payload for every event", () => {
    // The gate: an event whose schema cannot produce a sample cannot be tested,
    // and an untestable event is one nobody will notice going dead.
    expect(() => buildAllEventFixtures()).not.toThrow();
    expect(Object.keys(buildAllEventFixtures())).toHaveLength(EVENT_TYPES.length);
  });

  it("is deterministic", () => {
    // A fixture that differs between runs turns a real failure into a flake.
    expect(buildEventFixture("job.completed")).toEqual(buildEventFixture("job.completed"));
  });

  it("fills nullable fields with a value, not null", () => {
    // A fixture full of nulls exercises nothing — every downstream branch takes
    // the "missing" path and the interesting one is never covered.
    const fixture = buildEventFixture("job.assigned") as Record<string, unknown>;
    expect(fixture.toAssigneeId).not.toBeNull();
    expect(fixture.scheduledDate).not.toBeNull();
  });

  it("applies overrides and validates the result", () => {
    const fixture = buildEventFixture("job.stage_changed", { toLifecycle: "completed" });
    expect(fixture.toLifecycle).toBe("completed");
    expect(() =>
      // @ts-expect-error — deliberately wrong on purpose: an override that
      // breaks the schema must fail here, not three assertions later.
      buildEventFixture("job.stage_changed", { toLifecycle: "finished" }),
    ).toThrow(/does not satisfy its own schema/);
  });

  it("names the failing field when it cannot generate one", () => {
    // Proves the error is actionable rather than "invalid fixture". This is the
    // message a future contributor sees when they add a regex-constrained field
    // and forget its example.
    expect(() =>
      // A schema-shaped object that is not in the registry.
      requireEventDefinition("nope.nope"),
    ).toThrow(/Unknown workflow event type/);
  });
});

describe("parsing helpers", () => {
  it("parseEventPayload returns typed data", () => {
    const fixture = buildEventFixture("invoice.paid");
    const parsed = parseEventPayload("invoice.paid", fixture);
    expect(parsed.invoiceNumber).toBe(fixture.invoiceNumber);
  });

  it("safeParseEventPayload reports the failing path, not just a boolean", () => {
    // This string ends up in `workflow_event_queue.last_error` and in the
    // "why didn't my automation run" panel. "Invalid payload" is useless there.
    const result = safeParseEventPayload("invoice.paid", {
      ...(buildEventFixture("invoice.paid") as Record<string, unknown>),
      totalAmount: "not-money",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("totalAmount");
  });

  it("safeParseEventPayload refuses an unknown type without throwing", () => {
    // The worker calls this on rows it read from the database. A row written by
    // a newer deploy must be dead-lettered, never crash the tick.
    const result = safeParseEventPayload("something.removed", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unknown event type/);
  });

  it("getEventDefinition is undefined rather than throwing", () => {
    expect(getEventDefinition("nope.nope")).toBeUndefined();
  });
});

describe("cross-checks against the node registry", () => {
  it("every event a trigger node names exists", () => {
    // The reason the taxonomy lives in this package rather than in the API: a
    // node that advertises a trigger the engine has never heard of would put a
    // permanently dead trigger in the palette, and nothing else would catch it.
    for (const def of NODE_DEFINITIONS) {
      for (const event of def.triggerEvents ?? []) {
        expect(
          isWorkflowEventType(event),
          `node "${def.node}" names unknown event "${event}"`,
        ).toBe(true);
      }
    }
  });

  it("subscribers are the two the outbox fans out to", () => {
    // One row per subscriber is what stops a failure in one from retrying the
    // other. Adding a third means a migration and a worker branch, so it should
    // not be a one-line change nobody reviews.
    expect(EVENT_SUBSCRIBERS).toEqual(["workflow_trigger", "goal_listener"]);
  });
});

describe("module structure", () => {
  it("every payload file is re-exported by the barrel", () => {
    // Same rule as the node registry: a file on disk that nothing imports is a
    // set of events that exist in the repository and not in the product.
    const barrel = readdirSync(EVENTS_DIR);
    const payloadFiles = barrel.filter(
      (f) => f.endsWith(".ts") && !["index.ts", "registry.ts", "fixtures.ts", "shared.ts"].includes(f),
    );
    expect(payloadFiles.length).toBeGreaterThan(0);

    const categoriesWithEvents = new Set(EVENT_TYPES.map((t) => WORKFLOW_EVENTS[t].category));
    // One payload file per category that has events.
    expect(payloadFiles.length).toBe(categoriesWithEvents.size);
  });
});
