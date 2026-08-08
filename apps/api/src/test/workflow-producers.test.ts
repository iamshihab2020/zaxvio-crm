import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { EVENT_TYPES, WORKFLOW_EVENTS } from "@hvac-saas/workflow-nodes";
import * as producers from "../services/workflow/events/producers/index.js";
import {
  changedFields,
  daysBetween,
  isoDate,
  isoDateTime,
  isSettled,
  money,
  optionalMoney,
} from "../services/workflow/events/producers/shared.js";

/**
 * Producer discipline — docs/workflow-automation/wf-06 §6.1.
 *
 * The plan called for an ESLint rule banning object spread inside the producer
 * files. **This repo has no ESLint configuration at all** — `pnpm lint` runs
 * `eslint src --fix` against nothing — so adding one would mean introducing
 * linting to the whole codebase as a side effect of a workflow phase. The rule
 * is a test instead: it runs under `pnpm test`, which does exist and does pass,
 * and it fails the build for the same reason the lint rule would have.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PRODUCERS_DIR = join(HERE, "..", "services", "workflow", "events", "producers");

function producerFiles(): { name: string; source: string }[] {
  return readdirSync(PRODUCERS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((name) => ({
      name,
      source: readFileSync(join(PRODUCERS_DIR, name), "utf8"),
    }));
}

/** Comments legitimately discuss `...row`; only real code is checked. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the no-spread rule", () => {
  it("no producer file spreads anything into an object", () => {
    // The defect: `...job` compiles, carries every column the row happens to
    // have, and silently changes shape when a migration adds one. That is how
    // the reference implementation shipped `pipeline_stage_id` to a consumer
    // reading `stageId` and lost every stage-filtered automation for months.
    const offenders: string[] = [];
    for (const { name, source } of producerFiles()) {
      const code = stripComments(source);
      // Object/array spread and rest are all `...` in source. None of them have
      // any business here: every payload field is written out by name.
      const lines = code.split("\n");
      lines.forEach((line, i) => {
        if (line.includes("...")) offenders.push(`${name}:${i + 1} ${line.trim()}`);
      });
    }
    expect(offenders, `spread found in producers:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("checks files that actually exist", () => {
    // Guards the guard: a glob that silently matched nothing would make the
    // rule above pass for ever.
    const files = producerFiles();
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.map((f) => f.name)).toContain("job.ts");
  });
});

describe("producer coverage", () => {
  it("exports a producer for every domain event due in P2", () => {
    // A P2 event with no producer is an event that exists in the registry, in
    // the palette and in the docs, and can never fire.
    const expected = EVENT_TYPES.filter(
      (t) => WORKFLOW_EVENTS[t].phase === "P2" && WORKFLOW_EVENTS[t].origin === "domain",
    );

    // `job.stage_changed` → `jobStageChanged`
    const camel = (type: string) =>
      type
        .replace(/[._](\w)/g, (_, c: string) => c.toUpperCase())
        .replace(/^(\w)/, (_, c: string) => c.toLowerCase());

    const missing = expected.filter((type) => {
      const fn = (producers as Record<string, unknown>)[camel(type)];
      return typeof fn !== "function";
    });

    expect(missing, `no producer exported for: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no producer for an event that does not exist", () => {
    // The other direction: a producer named after a renamed event would compile
    // (it is just a function) and never be called.
    const eventNames = new Set(
      EVENT_TYPES.map((t) =>
        t
          .replace(/[._](\w)/g, (_, c: string) => c.toUpperCase())
          .replace(/^(\w)/, (_, c: string) => c.toLowerCase()),
      ),
    );
    // Helpers and types are exported from the barrel too; only check the ones
    // that look like event producers, i.e. verbs matching an event shape.
    const suspicious = Object.keys(producers).filter(
      (name) =>
        /^(customer|job|booking|quote|invoice|equipment|message|contract|schedule)[A-Z]/.test(
          name,
        ) && !eventNames.has(name),
    );
    expect(suspicious, `producers naming no known event: ${suspicious.join(", ")}`).toEqual([]);
  });
});

describe("money", () => {
  it("passes a numeric string through untouched", () => {
    // The whole reason money is a string: `"1250.00"` must survive to the
    // payload as `"1250.00"`, not become 1250 and back to "1250".
    expect(money("1250.00")).toBe("1250.00");
    expect(money("0.01")).toBe("0.01");
    expect(money("-45.50")).toBe("-45.50");
  });

  it("turns an absent amount into zero, not null", () => {
    // A filter asking "greater than 100" against null has no good answer;
    // against "0.00" it is simply false.
    expect(money(null)).toBe("0.00");
    expect(money(undefined)).toBe("0.00");
  });

  it("formats a computed number to two places", () => {
    expect(money(1250)).toBe("1250.00");
    expect(money(0.1 + 0.2)).toBe("0.30");
  });

  it("refuses to emit NaN or Infinity as an amount", () => {
    // `parseFloat` of an empty column gives NaN, and `"NaN"` would fail the
    // payload's regex at the far end of the pipeline instead of here.
    expect(money(Number.NaN)).toBe("0.00");
    expect(money(Number.POSITIVE_INFINITY)).toBe("0.00");
  });

  it("optionalMoney keeps the distinction between none and zero", () => {
    expect(optionalMoney(null)).toBeNull();
    expect(optionalMoney(0)).toBe("0.00");
  });

  it("isSettled treats an exact zero and an overpayment as settled", () => {
    expect(isSettled("0.00")).toBe(true);
    expect(isSettled("-50.00")).toBe(true);
    expect(isSettled("0.01")).toBe(false);
    expect(isSettled(null)).toBe(true);
  });
});

describe("dates", () => {
  it("always produces an ISO string, never a Date", () => {
    // A `Date` parses on the producer side and comes back a string from jsonb,
    // so it would fail the worker's parse — write/read drift introduced by the
    // producer itself.
    const out = isoDateTime(new Date("2026-08-07T13:00:00.000Z"));
    expect(typeof out).toBe("string");
    expect(out).toBe("2026-08-07T13:00:00.000Z");
  });

  it("takes the UTC date, not the server's local one", () => {
    // A job scheduled for the 1st must not be stamped the 31st because the
    // server happens to sit west of UTC.
    expect(isoDate(new Date("2026-08-01T02:00:00.000Z"))).toBe("2026-08-01");
  });

  it("passes a Postgres date string straight through", () => {
    expect(isoDate("2026-08-07")).toBe("2026-08-07");
    expect(isoDate(null)).toBeNull();
  });

  it("daysBetween counts whole days and tolerates missing ends", () => {
    expect(daysBetween("2026-08-01T00:00:00Z", "2026-08-08T00:00:00Z")).toBe(7);
    expect(daysBetween(null, "2026-08-08T00:00:00Z")).toBeNull();
    expect(daysBetween("nonsense", "2026-08-08T00:00:00Z")).toBeNull();
  });
});

describe("changedFields", () => {
  it("lists only what a PATCH actually changed", () => {
    const before = { title: "Old", priority: "standard", notes: null };
    expect(changedFields(before, { title: "New" })).toEqual(["title"]);
    expect(changedFields(before, { title: "Old" })).toEqual([]);
  });

  it("ignores keys the caller did not mention", () => {
    // An absent key means "not mentioned", not "set to undefined". Reporting it
    // would fire an automation for a field the request never touched.
    const before = { title: "Old", priority: "standard" };
    expect(changedFields(before, { priority: undefined })).toEqual([]);
  });

  it("does not report a numeric string that became a number", () => {
    // `numeric` arrives as a string and a form may send a number for the same
    // column. `"100.00"` → 100 is not an edit anybody made.
    const before = { totalAmount: "100" };
    expect(changedFields(before, { totalAmount: 100 })).toEqual([]);
  });

  it("reports a change to or from null", () => {
    const before = { assigneeId: null };
    expect(changedFields(before, { assigneeId: "usr_1" })).toEqual(["assigneeId"]);
    expect(changedFields({ assigneeId: "usr_1" }, { assigneeId: null })).toEqual([
      "assigneeId",
    ]);
  });

  it("compares dates by value", () => {
    const d = new Date("2026-08-07T00:00:00Z");
    expect(changedFields({ at: d }, { at: new Date("2026-08-07T00:00:00Z") })).toEqual([]);
    expect(changedFields({ at: d }, { at: new Date("2026-08-08T00:00:00Z") })).toEqual(["at"]);
  });

  it("caps at the payload's limit", () => {
    // The payload allows 64. Producing 100 would fail the parse at emit time,
    // which would turn a wide edit into a 500.
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) {
      before[`f${i}`] = "a";
      after[`f${i}`] = "b";
    }
    expect(changedFields(before, after)).toHaveLength(64);
  });
});
