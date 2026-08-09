import { describe, expect, it } from "vitest";

import type { ExecutionContext } from "@hvac-saas/workflow-nodes";
import {
  encode,
  interpolateParameters,
  interpolateString,
} from "../services/workflow/engine/interpolate.js";

/**
 * Interpolator — docs/workflow-automation/wf-07-variables.md §7.3/§7.4.
 *
 * The highest-value engine tests, and they need no database: every failure mode
 * here reaches a customer's inbox. A blank email, a raw `{{token}}`, an
 * unescaped `<script>` in a last name, or a date rendered a day early are all
 * things this module is the last line against.
 */

function ctx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    tenantId: "t1",
    timezone: "America/Chicago",
    workflowId: "w1",
    workflowName: "Quote follow-up",
    versionId: "v1",
    executionId: "e1",
    subject: { type: "job", id: "j1" },
    customer: {
      id: "c1",
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
    tenant: {
      businessName: "Shihab Housing",
      ownerName: null,
      email: null,
      phone: "3125550148",
      address: null,
      city: null,
      state: null,
      zipCode: null,
      fullAddress: "",
      logoUrl: null,
      licenseNumber: null,
      bookingUrl: null,
      googleReviewUrl: null,
      timezone: "America/Chicago",
    },
    trigger: { event: "job.completed", payload: { toLifecycle: "completed" } },
    nodeOutputs: {},
    nodeLabels: {},
    vars: {},
    ...overrides,
  };
}

describe("resolution", () => {
  it("substitutes a declared variable", () => {
    const { value } = interpolateString("Hi {{customer.firstName}},", ctx());
    expect(value).toBe("Hi Dana,");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(interpolateString("{{  customer.firstName  }}", ctx()).value).toBe("Dana");
  });

  it("leaves text with no tokens exactly as it was", () => {
    const text = "No variables here at all.";
    expect(interpolateString(text, ctx()).value).toBe(text);
  });

  it("renders an empty string for a null value, not the word null", () => {
    // `Hi null,` in a customer's inbox is worse than `Hi ,`.
    const c = ctx();
    c.customer!.email = null;
    expect(interpolateString("[{{customer.email}}]", c).value).toBe("[]");
  });
});

describe("formatting comes from the declaration, never from the value", () => {
  it("formats a phone number because the declaration says phone", () => {
    expect(interpolateString("{{customer.phone}}", ctx()).value).toBe("(312) 555-0148");
  });

  it("does NOT format a ten-digit value that is not declared as a phone", () => {
    // A-09 in the reference system: a ten-digit Google Ads campaign id rendered
    // as `(123) 456-7890`. Shape-sniffing is the bug; `zipCode` is a plain
    // string declaration and must come out untouched.
    const c = ctx();
    c.customer!.zipCode = "1234567890";
    expect(interpolateString("{{customer.zipCode}}", c).value).toBe("1234567890");
  });

  it("renders a date column without the UTC-midnight day shift", () => {
    // QUO-10: `new Date("2026-08-01")` is UTC midnight rendered in the process
    // zone, so it printed 31 July anywhere west of UTC, and the emailed quote
    // disagreed with the customer portal about the same field.
    const c = ctx({
      job: {
        id: "j1",
        number: "JOB-1",
        title: "t",
        description: null,
        serviceType: "maintenance",
        priority: "standard",
        status: "s",
        stageName: null,
        stageLifecycle: null,
        pipelineName: null,
        scheduledDate: "2026-08-01",
        scheduledStart: "09:00:00",
        scheduledEnd: null,
        address: null,
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "1250.00",
        assigneeName: null,
        assigneeEmail: null,
        completedAt: null,
        actualHours: null,
        marginPercent: null,
        costCoverage: "none",
      },
    });
    expect(interpolateString("{{job.scheduledDate}}", c).value).toBe("Aug 1, 2026");
  });

  it("renders a time with its timezone abbreviation", () => {
    // wf-05 §5.5: a reminder that says "9:00 AM" and one that says "9:00 AM
    // CDT" are different products, and the first gets somebody to a job at the
    // wrong hour.
    const c = ctx({
      job: {
        id: "j1",
        number: "JOB-1",
        title: "t",
        description: null,
        serviceType: "maintenance",
        priority: "standard",
        status: "s",
        stageName: null,
        stageLifecycle: null,
        pipelineName: null,
        scheduledDate: "2026-08-01",
        scheduledStart: "09:00:00",
        scheduledEnd: null,
        address: null,
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "1250.00",
        assigneeName: null,
        assigneeEmail: null,
        completedAt: null,
        actualHours: null,
        marginPercent: null,
        costCoverage: "none",
      },
    });
    expect(interpolateString("{{job.scheduledStart}}", c).value).toBe("9:00 AM CDT");
  });

  it("formats money from a decimal string", () => {
    const c = ctx({
      job: {
        id: "j1",
        number: "JOB-1",
        title: "t",
        description: null,
        serviceType: "maintenance",
        priority: "standard",
        status: "s",
        stageName: null,
        stageLifecycle: null,
        pipelineName: null,
        scheduledDate: "2026-08-01",
        scheduledStart: null,
        scheduledEnd: null,
        address: null,
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "1250.00",
        assigneeName: null,
        assigneeEmail: null,
        completedAt: null,
        actualHours: null,
        marginPercent: null,
        costCoverage: "none",
      },
    });
    expect(interpolateString("{{job.total}}", c).value).toBe("$1,250.00");
  });
});

describe("blocked paths", () => {
  it("refuses env visibly rather than silently", () => {
    // A user who tries this must see the refusal in their test email and learn
    // immediately, rather than wonder why the line came out blank.
    const { value } = interpolateString("{{env.DATABASE_URL}}", ctx());
    expect(value).toBe("[BLOCKED: not allowed]");
  });

  it("refuses prototype-chain probes", () => {
    for (const path of ["__proto__.x", "a.constructor.b", "x.prototype.y", "process.env"]) {
      expect(interpolateString(`{{${path}}}`, ctx()).value).toBe("[BLOCKED: not allowed]");
    }
  });

  it("cannot reach a context field that is not declared", () => {
    // Resolution goes through a closed map, so `tenantId` — which is on the
    // context and is emphatically not a variable — is simply unknown.
    const { value, diagnostics } = interpolateString("{{tenantId}}", ctx());
    expect(value).toBe("");
    expect(diagnostics).toHaveLength(1);
  });

  it("refuses inherited properties in a dynamic namespace", () => {
    // `in` and bare bracket access walk the prototype chain, so `toString`
    // would resolve to a function. Own-property checks are what stop it.
    const c = ctx();
    c.vars = { real: "yes" };
    expect(interpolateString("{{vars.toString}}", c).value).toBe("");
    expect(interpolateString("{{vars.real}}", c).value).toBe("yes");
  });
});

describe("diagnostics", () => {
  it("names the field and suggests a correction", () => {
    const { value, diagnostics } = interpolateString(
      "Hi {{customer.emial}}",
      ctx(),
      "body",
    );
    expect(value).toBe("Hi ");
    expect(diagnostics[0].field).toBe("body");
    expect(diagnostics[0].suggestions).toContain("customer.email");
    expect(diagnostics[0].message).toContain("did you mean");
  });

  it("reports every unknown token, not just the first", () => {
    const { diagnostics } = interpolateString("{{a.b}} {{c.d}}", ctx());
    expect(diagnostics).toHaveLength(2);
  });
});

describe("dynamic namespaces", () => {
  it("resolves a previous node's output by node id", () => {
    const c = ctx();
    c.nodeOutputs = { n1: { messageId: "msg_123" } };
    expect(interpolateString("{{previous.n1.messageId}}", c).value).toBe("msg_123");
  });

  it("resolves it by the node's user-given label too", () => {
    // Node ids are UUIDs nobody types. `{{previous.Send Email.messageId}}` is
    // what an author would actually write.
    const c = ctx();
    c.nodeOutputs = { n1: { messageId: "msg_123" } };
    c.nodeLabels = { "Send Email": "n1" };
    expect(interpolateString("{{previous.Send Email.messageId}}", c).value).toBe("msg_123");
  });

  it("resolves the trigger payload", () => {
    expect(interpolateString("{{trigger.toLifecycle}}", ctx()).value).toBe("completed");
  });

  it("resolves loop state, and nothing when there is no loop", () => {
    const inLoop = ctx();
    inLoop.loop = { item: "a", index: 0, total: 3 };
    expect(interpolateString("{{loop.total}}", inLoop).value).toBe("3");
    expect(interpolateString("{{loop.total}}", ctx()).value).toBe("");
  });
});

describe("encoding", () => {
  it("html-escapes by declaration", () => {
    // A customer's own last name lands in a React Email template. `O'Brien
    // <script>` unescaped is a stored XSS in an email nobody audits.
    const c = ctx();
    c.customer!.lastName = '<script>alert("x")</script>';
    const { value } = interpolateString("{{customer.lastName}}", c);
    expect(value).not.toContain("<script>");
    expect(value).toContain("&lt;script&gt;");
  });

  it("leaves a subject line unencoded, because sanitizeSubject owns that", () => {
    // An html-encoded subject prints `&amp;` in an inbox. The protection a
    // subject needs is CR/LF stripping, which happens at the sender.
    expect(encode("Tom & Jerry", "none")).toBe("Tom & Jerry");
  });

  it("url-encodes when the field declares it", () => {
    expect(encode("a b&c", "url")).toBe("a%20b%26c");
  });
});

describe("whole-object interpolation", () => {
  it("walks strings, arrays and nested objects in one pass", () => {
    // D-08: one pass over everything, before dispatch, so a new node cannot
    // ship a field that forgot to resolve variables.
    const { value } = interpolateParameters(
      {
        subject: "Hi {{customer.firstName}}",
        tags: ["{{customer.city}}", "static"],
        nested: { deep: "{{customer.state}}" },
        count: 3,
      },
      ctx(),
    );

    expect(value.subject).toBe("Hi Dana");
    expect(value.tags).toEqual(["Chicago", "static"]);
    expect(value.nested).toEqual({ deep: "IL" });
    expect(value.count).toBe(3);
  });

  it("skips noInterpolate fields verbatim", () => {
    const { value } = interpolateParameters(
      { pattern: "{{not-a-variable}}" },
      ctx(),
      { skip: new Set(["pattern"]) },
    );
    expect(value.pattern).toBe("{{not-a-variable}}");
  });

  it("applies a per-field encoding override", () => {
    const c = ctx();
    c.customer!.firstName = "A&B";
    const { value } = interpolateParameters(
      { link: "{{customer.firstName}}" },
      c,
      { encodings: { link: "url" } },
    );
    expect(value.link).toBe("A%26B");
  });
});
