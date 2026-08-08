import { describe, expect, it } from "vitest";

import { FILTER_OPERATORS, type NodeDefinition } from "../node-definition.js";
import { applyOperator, getPath, isUnset } from "../triggers/operators.js";
import { describeMatch, matchesFilters } from "../triggers/match.js";

/**
 * The operator matrix — docs/workflow-automation/wf-06 §6.4.
 *
 * One generic evaluator serves every trigger, so one file covers every filter
 * in the product. That is the whole return on the declarative design: the
 * system this was ported from hand-codes filtering across 3,146 lines, where a
 * missing branch means a configured filter silently does nothing.
 */

describe("isUnset — the load-bearing function", () => {
  it("treats 0 and false as values", () => {
    // The concrete bug: a "minimum total: 0" filter read as unset either
    // matches everything or nothing, and the form said neither.
    expect(isUnset(0)).toBe(false);
    expect(isUnset(false)).toBe(false);
  });

  it("treats an unconfigured filter as unset", () => {
    // The builder persists every property, so an unconfigured filter is
    // present-but-empty rather than absent.
    expect(isUnset(null)).toBe(true);
    expect(isUnset(undefined)).toBe(true);
    expect(isUnset("")).toBe(true);
    expect(isUnset("   ")).toBe(true);
    expect(isUnset([])).toBe(true);
  });

  it("treats the dropdown's Any sentinel as unset", () => {
    // A `<Select>` cannot hold `undefined`; the "Any" row has to carry a value.
    expect(isUnset("__any__")).toBe(true);
  });
});

describe("getPath", () => {
  it("walks a dotted path", () => {
    expect(getPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
  });

  it("returns undefined rather than throwing on a missing branch", () => {
    expect(getPath({ a: 1 }, "a.b.c")).toBeUndefined();
    expect(getPath(null, "a")).toBeUndefined();
  });

  it("refuses inherited properties", () => {
    // `in` and bare bracket access both walk the prototype, so `toString`
    // would resolve to a function and compare truthy.
    expect(getPath({}, "toString")).toBeUndefined();
    expect(getPath({}, "constructor")).toBeUndefined();
  });
});

describe("equality", () => {
  it("compares money across the string/number boundary", () => {
    // Postgres returns `numeric` as "1250.00" and a form sends 1250. Strict
    // equality would make "total equals 1250" never match, and the user has no
    // way to know which side stringified.
    expect(applyOperator("equals", "1250.00", 1250)).toBe(true);
    expect(applyOperator("equals", 1250, "1250")).toBe(true);
  });

  it("compares strings case-insensitively", () => {
    expect(applyOperator("equals", "Maintenance", "maintenance")).toBe(true);
  });

  it("never equates a missing value with anything", () => {
    // "Not set" is not a value to match against — that question is `isEmpty`.
    expect(applyOperator("equals", null, "")).toBe(false);
    expect(applyOperator("equals", undefined, null)).toBe(false);
  });

  it("keeps booleans strict", () => {
    expect(applyOperator("equals", true, true)).toBe(true);
    expect(applyOperator("equals", true, "true")).toBe(false);
  });
});

describe("numeric comparison", () => {
  it("compares decimal strings numerically", () => {
    expect(applyOperator("greaterThanOrEqual", "2000.00", 2000)).toBe(true);
    expect(applyOperator("greaterThan", "1999.99", 2000)).toBe(false);
  });

  it("refuses a comparison it cannot make", () => {
    // Not `true`. An unanswerable question is not a match, and the opposite
    // default makes a malformed filter fire on everything.
    expect(applyOperator("greaterThan", "not a number", 10)).toBe(false);
    expect(applyOperator("lessThan", null, 10)).toBe(false);
  });

  it("does not read an empty string as zero", () => {
    // `Number("")` is 0, which would make "total greater than -1" match a job
    // with no total — answering a question about a value that does not exist.
    expect(applyOperator("greaterThan", "", -1)).toBe(false);
  });

  it("treats between as inclusive at both ends", () => {
    expect(applyOperator("between", 100, [100, 200])).toBe(true);
    expect(applyOperator("between", 200, [100, 200])).toBe(true);
    expect(applyOperator("between", 201, [100, 200])).toBe(false);
  });
});

describe("emptiness", () => {
  it("separates an empty value from an unset filter", () => {
    // `isUnset` asks whether the author configured a filter. `isEmpty` asks
    // whether the record's value is blank. Different questions.
    expect(applyOperator("isEmpty", "", null)).toBe(true);
    expect(applyOperator("isEmpty", null, null)).toBe(true);
    expect(applyOperator("isNotEmpty", "dana@example.com", null)).toBe(true);
  });

  it("does not call zero empty", () => {
    // An invoice with a zero balance has a balance.
    expect(applyOperator("isEmpty", 0, null)).toBe(false);
  });
});

describe("boolean operators", () => {
  it("is strict about isTrue and isFalse", () => {
    expect(applyOperator("isTrue", true, null)).toBe(true);
    expect(applyOperator("isTrue", "false", null)).toBe(false);
    expect(applyOperator("isTrue", 1, null)).toBe(false);
    expect(applyOperator("isFalse", false, null)).toBe(true);
    expect(applyOperator("isFalse", 0, null)).toBe(false);
  });
});

describe("list operators", () => {
  it("matches any member", () => {
    expect(applyOperator("inList", "repair", ["repair", "maintenance"])).toBe(true);
    expect(applyOperator("inList", "installation", ["repair"])).toBe(false);
    expect(applyOperator("notInList", "installation", ["repair"])).toBe(true);
  });

  it("accepts a single configured value as a one-item list", () => {
    expect(applyOperator("inList", "repair", "repair")).toBe(true);
  });
});

describe("date operators", () => {
  it("anchors a date-only string at noon, not midnight", () => {
    // Midnight UTC renders as the previous day in every negative-offset zone —
    // the QUO-10 class of bug, applied to a comparison instead of a render.
    expect(applyOperator("dateBefore", "2026-08-01", "2026-08-02")).toBe(true);
    expect(applyOperator("dateAfter", "2026-08-03", "2026-08-02")).toBe(true);
  });

  it("excludes past dates from dateWithinNext", () => {
    // "Expiring within 7 days" must not match a warranty that ended in March —
    // that is how a renewal automation emails somebody about a contract that
    // finished months ago.
    const past = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    expect(applyOperator("dateWithinNext", past, 7)).toBe(false);
    expect(applyOperator("dateWithinNext", soon, 7)).toBe(true);
  });

  it("excludes future dates from dateWithinLast", () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(applyOperator("dateWithinLast", soon, 7)).toBe(false);
    expect(applyOperator("dateWithinLast", recent, 7)).toBe(true);
  });

  it("compares isToday as calendar days, not instants", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(applyOperator("isToday", today, null)).toBe(true);
    expect(applyOperator("isToday", "1999-01-01", null)).toBe(false);
  });
});

describe("the operator set is closed and complete", () => {
  it("handles every declared operator without throwing", () => {
    // A new operator added to the union and not to the switch hits
    // `assertNever`. This is what turns that from a runtime surprise into a
    // failing test.
    for (const operator of FILTER_OPERATORS) {
      expect(() => applyOperator(operator, "x", "x")).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The evaluator over a whole definition
// ─────────────────────────────────────────────────────────────────────────────

const definition = {
  node: "trigger.test",
  version: 1,
  displayName: "Test",
  description: "d",
  icon: "IconTest",
  category: "trigger",
  inputs: [],
  outputs: [{ id: "main", label: "Then" }],
  triggerEvents: ["job.completed"],
  properties: [
    {
      displayName: "Only these service types",
      name: "serviceType",
      type: "multiOptions",
      options: [{ name: "Repair", value: "repair" }],
      filter: { path: "serviceType", operator: "inList" },
    },
    {
      displayName: "Only jobs worth at least",
      name: "minTotal",
      type: "moneyInput",
      filter: { path: "totalAmount", operator: "greaterThanOrEqual" },
    },
    {
      displayName: "Only when it becomes",
      name: "toLifecycle",
      type: "options",
      options: [{ name: "Completed", value: "completed" }],
      filter: { path: "toLifecycle", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;

const payload = {
  serviceType: "repair",
  totalAmount: "2400.00",
  toLifecycle: "completed",
  toStageName: "Done",
};

describe("matchesFilters", () => {
  it("matches everything when nothing is configured", () => {
    const result = matchesFilters(definition, {}, payload);
    expect(result.matched).toBe(true);
    expect(result.applied).toBe(0);
  });

  it("applies every configured filter", () => {
    const result = matchesFilters(
      definition,
      { serviceType: ["repair"], minTotal: 2000, toLifecycle: "completed" },
      payload,
    );
    expect(result.matched).toBe(true);
    expect(result.applied).toBe(3);
  });

  it("reports which filter refused, and with what", () => {
    // `failedOn`/`expected`/`actual` are the whole answer to "why didn't my
    // automation run?", which is the most common support question this feature
    // will generate.
    const result = matchesFilters(definition, { minTotal: 5000 }, payload);
    expect(result.matched).toBe(false);
    expect(result.failedOn).toBe("minTotal");
    expect(result.expected).toBe(5000);
    expect(result.actual).toBe("2400.00");
  });

  it("matches on the lifecycle, not on the stage label", () => {
    // A tenant can name a stage anything. Filtering on "Done" would break the
    // moment somebody renamed a column — which is precisely why
    // `job_pipeline_stages.lifecycle` exists.
    const renamed = { ...payload, toStageName: "Wrapped up" };
    const result = matchesFilters(definition, { toLifecycle: "completed" }, renamed);
    expect(result.matched).toBe(true);
  });

  it("skips a filter the author left empty, even beside one they set", () => {
    const result = matchesFilters(
      definition,
      { serviceType: [], minTotal: 2000, toLifecycle: "" },
      payload,
    );
    expect(result.matched).toBe(true);
    expect(result.applied).toBe(1);
  });

  it("does not match a payload missing the filtered field", () => {
    const result = matchesFilters(definition, { minTotal: 100 }, { serviceType: "repair" });
    expect(result.matched).toBe(false);
    expect(result.actual).toBeUndefined();
  });
});

describe("describeMatch", () => {
  it("says so when a trigger has no filters at all", () => {
    expect(describeMatch(matchesFilters(definition, {}, payload))).toContain(
      "runs every time",
    );
  });

  it("names the label a user would recognise, not the property name", () => {
    const result = matchesFilters(definition, { minTotal: 5000 }, payload);
    const sentence = describeMatch(result);
    expect(sentence).toContain("Only jobs worth at least");
    expect(sentence).not.toContain("minTotal");
  });
});
