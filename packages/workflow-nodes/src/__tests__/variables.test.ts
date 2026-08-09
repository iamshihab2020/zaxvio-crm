import { describe, expect, it } from "vitest";

import {
  VARIABLES,
  VARIABLE_MAP,
  namespaceOf,
  suggestVariables,
  variablesForSubject,
} from "../variables/index.js";
import { SUBJECT_TYPES } from "../node-definition.js";
import type { ExecutionContext } from "../execution-context.js";

/**
 * Variable table invariants — docs/workflow-automation/wf-07-variables.md.
 *
 * The reference implementation kept a path list and a resolver map, roughly 700
 * entries each, in sync **by convention**. Both failure modes it produced are
 * asserted against here: a path declared but not mapped (resolves to `""`), and
 * a path mapped but not declared (works, never appears in the picker). Deriving
 * one array from the other is what removes the class; these tests are what stop
 * a second source of truth quietly reappearing.
 */

/** A context with every namespace populated, so no resolver is untested. */
function fullContext(): ExecutionContext {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    timezone: "America/Chicago",
    workflowId: "22222222-2222-2222-2222-222222222222",
    workflowName: "Quote follow-up",
    versionId: "33333333-3333-3333-3333-333333333333",
    executionId: "44444444-4444-4444-4444-444444444444",
    subject: { type: "job", id: "55555555-5555-5555-5555-555555555555" },
    customer: {
      id: "66666666-6666-6666-6666-666666666666",
      firstName: "Dana",
      lastName: "Whitfield",
      fullName: "Dana Whitfield",
      email: "dana@example.com",
      phone: "3125550148",
      address: "1420 W 18th St",
      city: "Chicago",
      state: "IL",
      zipCode: "60608",
      fullAddress: "1420 W 18th St, Chicago, IL 60608",
      notes: null,
      isOptedOut: false,
    },
    job: {
      id: "55555555-5555-5555-5555-555555555555",
      number: "JOB-1042",
      title: "Annual furnace service",
      description: null,
      serviceType: "maintenance",
      priority: "standard",
      status: "In Progress",
      stageName: "In Progress",
      stageLifecycle: "in_progress",
      pipelineName: "Residential",
      scheduledDate: "2026-08-08",
      scheduledStart: "09:00:00",
      scheduledEnd: "11:00:00",
      address: "1420 W 18th St",
      subtotal: "420.00",
      taxAmount: "34.65",
      total: "454.65",
      assigneeName: "Marcus Webb",
      assigneeEmail: "marcus@example.com",
      completedAt: null,
      actualHours: "2.50",
      marginPercent: 38,
      costCoverage: "complete",
    },
    invoice: {
      id: "77777777-7777-7777-7777-777777777777",
      number: "INV-2048",
      status: "overdue",
      issueDate: "2026-07-09",
      dueDate: "2026-08-08",
      subtotal: "1150.00",
      taxAmount: "94.88",
      total: "1244.88",
      amountPaid: "500.00",
      balanceDue: "744.88",
      daysOverdue: 12,
      paymentTerms: "Net 30",
      publicUrl: "https://example.com/i/1",
    },
    quote: {
      id: "88888888-8888-8888-8888-888888888888",
      number: "QT-0311",
      status: "sent",
      issueDate: "2026-08-01",
      expiryDate: "2026-08-31",
      subtotal: "2400.00",
      taxAmount: "198.00",
      total: "2598.00",
      publicUrl: "https://example.com/q/1",
      acceptUrl: "https://example.com/q/1#accept",
    },
    booking: {
      id: "99999999-9999-9999-9999-999999999999",
      date: "2026-08-12",
      startTime: "09:00:00",
      endTime: null,
      serviceType: "repair",
      status: "pending",
      source: "portal",
      notes: null,
    },
    equipment: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Carrier 59TP6B",
      type: "furnace",
      make: "Carrier",
      model: "59TP6B",
      serialNumber: "4218H31742",
      installDate: "2019-03-04",
      warrantyExpiresAt: "2029-03-04",
      location: "Attic",
    },
    contract: {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Annual Maintenance Plan",
      startDate: "2025-09-01",
      endDate: "2026-08-31",
      annualPrice: "349.00",
      visitsPerYear: 2,
      frequency: "semi_annual",
      nextVisitDue: null,
    },
    tenant: {
      businessName: "Shihab Housing",
      ownerName: "Shihab Rahman",
      email: "hello@example.com",
      phone: "3125550148",
      address: "88 N Halsted St",
      city: "Chicago",
      state: "IL",
      zipCode: "60661",
      fullAddress: "88 N Halsted St, Chicago, IL 60661",
      logoUrl: null,
      licenseNumber: "IL-HVAC-118342",
      bookingUrl: "https://example.com/book/x",
      googleReviewUrl: null,
      timezone: "America/Chicago",
    },
    assignee: {
      id: "user_2abcDEF",
      name: "Marcus Webb",
      email: "marcus@example.com",
    },
    trigger: { event: "job.completed", payload: { toLifecycle: "completed" } },
    nodeOutputs: {},
    nodeLabels: {},
    vars: {},
  };
}

describe("variable declarations", () => {
  it("has no duplicate paths", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const v of VARIABLES) {
      if (seen.has(v.path)) duplicates.push(v.path);
      seen.add(v.path);
    }
    expect(duplicates).toEqual([]);
  });

  it("derives the resolver map from the array, so neither can drift", () => {
    // The whole point. If these ever disagree there are two sources of truth
    // again, which is the defect this design exists to remove.
    expect(VARIABLE_MAP.size).toBe(VARIABLES.length);
    for (const v of VARIABLES) {
      expect(VARIABLE_MAP.get(v.path)).toBe(v);
    }
  });

  it("uses lowerCamel dotted paths throughout", () => {
    // Paths are a permanent public API — saved automations store the exact
    // string. One snake_case id frozen among dotted ones is a thing the
    // reference system could never fix.
    const bad = VARIABLES.filter(
      (v) => !/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(v.path),
    );
    expect(bad.map((v) => v.path)).toEqual([]);
  });

  it("gives every variable a label, a description and a sample", () => {
    // The sample is not decoration: it is what the picker shows, and therefore
    // a promise about what the email will actually say.
    const incomplete = VARIABLES.filter(
      (v) => !v.label.trim() || !v.description.trim() || !v.sample.trim(),
    );
    expect(incomplete.map((v) => v.path)).toEqual([]);
  });

  it("scopes every subject-specific variable to a real subject type", () => {
    const bad = VARIABLES.filter((v) =>
      v.providedBy?.some((s) => !SUBJECT_TYPES.includes(s)),
    );
    expect(bad.map((v) => v.path)).toEqual([]);
  });

  it("resolves every declared path without throwing", () => {
    // A resolver that throws on a fully-populated context is a bug that would
    // otherwise surface as a failed run in a customer's workspace.
    const ctx = fullContext();
    for (const v of VARIABLES) {
      expect(() => v.resolve(ctx)).not.toThrow();
    }
  });

  it("returns null rather than empty string for missing namespaces", () => {
    // Null and "" mean different things: "this customer has no phone" versus
    // "this variable does not exist". The interpolator distinguishes them, and
    // it can only do that if the resolvers do.
    const ctx = fullContext();
    ctx.job = undefined;
    for (const v of VARIABLES.filter((x) => namespaceOf(x.path) === "job")) {
      expect(v.resolve(ctx)).toBeNull();
    }
  });
});

describe("picker scoping", () => {
  it("does not offer invoice fields on a booking automation", () => {
    // FE-V2, and the difference between a blank email and a support ticket.
    const offered = variablesForSubject("booking").map((v) => v.path);
    expect(offered).not.toContain("invoice.balanceDue");
    expect(offered).toContain("booking.date");
  });

  it("always offers customer and tenant, whatever the subject", () => {
    // Every subject table carries a customer id (D-02), so these two are
    // unconditional by design rather than by luck.
    for (const subject of SUBJECT_TYPES) {
      const offered = variablesForSubject(subject).map((v) => v.path);
      expect(offered).toContain("customer.email");
      expect(offered).toContain("tenant.businessName");
    }
  });
});

describe("suggestions", () => {
  it("suggests the right variable for a plausible typo", () => {
    expect(suggestVariables("customer.emial")).toContain("customer.email");
  });

  it("prefers a candidate in the same namespace", () => {
    // Someone who typed `customer.emial` meant something in `customer.`;
    // offering `tenant.email` first is noise.
    expect(suggestVariables("customer.emial")[0]).toBe("customer.email");
  });

  it("offers nothing for something that is not a near miss", () => {
    expect(suggestVariables("zzzzz.qqqqqqqqqq")).toEqual([]);
  });
});
