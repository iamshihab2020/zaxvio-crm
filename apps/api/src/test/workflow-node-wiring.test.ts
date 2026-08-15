import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_NODES,
  allDefinitions,
  getDefinition,
  isTriggerNode,
} from "@hvac-saas/workflow-nodes";

/**
 * The ship gate, asserted.
 *
 * `ACTIVE_NODES` is what stops the palette offering a node whose executor does
 * not exist yet — and it is **decoration without this file**, because nothing
 * else connects a definition in `packages/workflow-nodes` to a function in
 * `apps/api`. The two live in different workspaces on purpose (the browser
 * needs the definitions and must never see the executors), which is exactly why
 * the link has to be tested rather than trusted to the compiler.
 *
 * ## Why this reads the barrel instead of importing it
 *
 * Importing `executors/index.js` pulls in `email-send.ts`, which reaches
 * `lib/email.ts` and `lib/email-consent.ts`, both of which import `lib/env.ts`
 * — and **`env.ts` calls `process.exit(1)` on a missing variable**. A unit test
 * that boots the email stack would kill the whole runner with no output on any
 * machine without a full `.env`, which is the failure mode `src/test/setup.ts`
 * was written to avoid in the first place.
 *
 * Parsing the barrel's own source is exactly as strong: the map is a literal,
 * so its keys are in the text, and a key that is not in the text is not in the
 * map. It is the same technique the registry test uses on its own barrel, for
 * the same reason.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const EXECUTOR_DIR = join(HERE, "..", "services", "workflow", "engine", "executors");
const BARREL = join(EXECUTOR_DIR, "index.ts");
const PRODUCER_DIR = join(HERE, "..", "services", "workflow", "events", "producers");
const SWEEP_DIR = join(HERE, "..", "services", "workflow", "sweeps");
/**
 * The inbound webhook receiver raises its event **directly**, not through a
 * producer, and that is correct rather than an omission: the outbox exists so an
 * event commits with the domain write that caused it, and a webhook has no
 * domain write. There is nothing to be transactional with.
 *
 * Scanned all the same, because the question this gate asks is "can this event
 * actually be raised" — and the answer for `webhook.received` lives here.
 */
const WEBHOOK_ROUTE = join(HERE, "..", "routes", "public", "workflow-webhook.ts");
const MATCHER = join(HERE, "..", "services", "workflow", "triggers", "index.ts");

/** Comments stripped first, so a node id mentioned in prose is not a mapping. */
function barrelSource(): string {
  return readFileSync(BARREL, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The keys of the `EXECUTORS` literal — `"job.completed": …`. */
function mappedNodeIds(): string[] {
  return [...barrelSource().matchAll(/"([a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+)"\s*:/g)].map(
    (m) => m[1],
  );
}

/**
 * Every executor module. One per node id, named for it.
 *
 * `*-shared.ts` is excluded by convention. The rule below exists because *"a
 * file that exists and is not imported is a node that silently does not run"* —
 * and a helper imported by two executors is reachable through them, so that
 * concern does not apply to it. The suffix is what makes the exemption
 * assertable rather than a list somebody has to maintain: a file either claims
 * to be an executor by its name, or it does not.
 */
function executorFiles(): string[] {
  return readdirSync(EXECUTOR_DIR)
    .filter((f) => statSync(join(EXECUTOR_DIR, f)).isFile())
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => f !== "index.ts" && f !== "types.ts")
    .filter((f) => !f.endsWith("-shared.ts"));
}

/** `customer.addNote` → `customer-add-note.ts`. The file naming convention. */
function moduleNameFor(nodeId: string): string {
  return `${nodeId
    .split(".")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase())
    .join("-")}.ts`;
}

describe("active nodes", () => {
  it("every active node has a definition", () => {
    const missing = ACTIVE_NODES.filter((id) => !getDefinition(id));
    expect(missing).toEqual([]);
  });

  it("every active node is mapped to an executor", () => {
    // The failure this prevents: a node in the palette, configurable and
    // saveable, that fails the first time anybody runs it.
    const mapped = new Set(mappedNodeIds());
    const missing = ACTIVE_NODES.filter((id) => !mapped.has(id));
    expect(missing).toEqual([]);
  });

  it("every mapped executor belongs to a node that is actually active", () => {
    // The other direction. An executor with no active node is dead code that
    // reads as coverage.
    const orphans = mappedNodeIds().filter((id) => !ACTIVE_NODES.includes(id));
    expect(orphans).toEqual([]);
  });

  it("every active node has an executor module on disk", () => {
    const files = new Set(executorFiles());
    const missing = ACTIVE_NODES.filter((id) => !files.has(moduleNameFor(id)));
    expect(missing).toEqual([]);
  });

  /**
   * The hole the other four did not cover.
   *
   * `trigger.invoice.overdue` shipped active with a definition, a payload
   * schema, an executor and a palette entry — and **nothing anywhere raised
   * `invoice.overdue`**. Every assertion above passed. A tenant could build
   * "chase this seven days after it's due", publish it, switch it on, and it
   * would never fire, silently, forever.
   *
   * A trigger node is only as real as its event's producer, so that is what is
   * asserted here. Source text rather than imports, for the reason at the top of
   * this file: importing the producer barrel boots `lib/env.ts`, which calls
   * `process.exit(1)` and takes the runner with it.
   */
  it("every event an active trigger declares can actually be raised", () => {
    const emitted = emittedEventTypes();

    const unraisable = ACTIVE_NODES.flatMap((id) => {
      const def = getDefinition(id);
      if (!def || !isTriggerNode(def)) return [];
      return (def.triggerEvents ?? [])
        // `manual.run` is raised by `POST /:id/runs`, not by a producer — the
        // one event whose origin is a request.
        .filter((event) => event !== "manual.run")
        .filter((event) => !emitted.has(event))
        .map((event) => `${id} declares ${event}`);
    });

    expect(unraisable).toEqual([]);
  });
});

describe("the trigger_types seam", () => {
  /**
   * The bug this exists for, and why nothing else caught it.
   *
   * `collectTriggerTypes` fills `workflow_versions.trigger_types` from
   * `def.triggerEvents` — **event names**, `job.completed`. The trigger matcher
   * queried that column with `LISTENERS_BY_EVENT.get(...)`, which yields the
   * **node ids** that listen for an event, `trigger.job.completed`. The overlap
   * of those two sets is empty for every trigger in the catalogue, so
   * `findCandidateVersions` returned nothing for every event ever dispatched and
   * **no event-triggered automation could fire at all**.
   *
   * Both sides were internally consistent, both were `string[]`, and manual runs
   * go straight to `execute()` without touching the matcher — so the feature
   * looked alive from every angle anyone had tested.
   *
   * The invariant is one sentence: **what publish writes must be what the
   * matcher queries.** Asserting the two are drawn from the same field is what
   * makes that structural rather than remembered.
   */
  it("no trigger declares an event that is really a node id", () => {
    // The contamination direction. `collectTriggerTypes` copies `triggerEvents`
    // into the column verbatim, so a definition that listed its own node id
    // there would put node ids in a column the matcher reads as event names —
    // and it would look completely reasonable in the definition file.
    const nodeIds = new Set(allDefinitions().map((d) => d.node));
    const triggers = allDefinitions().filter(isTriggerNode);
    expect(triggers.length).toBeGreaterThan(0);

    const contaminated = triggers.flatMap((def) =>
      (def.triggerEvents ?? [])
        .filter((event) => nodeIds.has(event) || event.startsWith("trigger."))
        .map((event) => `${def.node} declares ${event}`),
    );
    expect(contaminated).toEqual([]);
  });

  it("the matcher queries trigger_types with the event type, not node ids", () => {
    // The query direction, and the exact regression. Source text rather than an
    // import: `triggers/index.ts` reaches the database module, and this suite
    // deliberately boots nothing (see the note at the top of this file).
    //
    // `LISTENERS_BY_EVENT` yields node ids and is still correct where it picks
    // which trigger nodes inside a candidate to evaluate — it is only wrong as
    // the argument to `findCandidateVersions`.
    const source = readFileSync(MATCHER, "utf8");

    const call = source.match(/findCandidateVersions\(\s*db,\s*event\.tenantId,\s*([^)]+)\)/);
    expect(call, "findCandidateVersions call site not found").toBeTruthy();
    expect(call![1].replace(/\s+/g, "")).toBe("[event.eventType]");
  });

  /**
   * The other half: a sweep that queries `trigger_types` itself.
   *
   * `sweeps/invoice-overdue.ts` filters tenants by that column, and it made the
   * same mistake — `ARRAY['trigger.invoice.overdue']` where the column holds
   * `invoice.overdue`. It would have emitted nothing, silently.
   */
  it("no sweep queries trigger_types with a node id", () => {
    const offenders: string[] = [];

    for (const file of readdirSync(SWEEP_DIR)) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(join(SWEEP_DIR, file), "utf8");
      if (!source.includes("trigger_types")) continue;

      for (const match of source.matchAll(/trigger_types\s*&&\s*ARRAY\[([^\]]*)\]/g)) {
        for (const raw of match[1].split(",")) {
          const value = raw.trim().replace(/^'|'$/g, "");
          if (value.startsWith("trigger.")) offenders.push(`${file}: ${value}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

/** Every `type: "<event>"` passed to `emitWorkflowEvent`, across producers and sweeps. */
function emittedEventTypes(): Set<string> {
  const dirs = [PRODUCER_DIR, SWEEP_DIR];
  const found = new Set<string>();

  // The one single-file source, for the reason above.
  for (const match of readFileSync(WEBHOOK_ROUTE, "utf8").matchAll(
    /type:\s*"([a-z][a-zA-Z0-9._]*)"/g,
  )) {
    found.add(match[1]);
  }

  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(join(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      // `_` is in the class because **event** types are snake_case
      // (`job.stage_changed`, `invoice.payment_recorded`) while **node** ids are
      // lowerCamel. Without it this stopped at the underscore, matched
      // `job.stage`, and reported a producer that plainly exists as missing —
      // the gate crying wolf on the first snake_case event a trigger declared.
      for (const match of source.matchAll(/type:\s*"([a-z][a-zA-Z0-9._]*)"/g)) {
        found.add(match[1]);
      }
    }
  }
  return found;
}

describe("the executor barrel", () => {
  it("imports every module in the directory", () => {
    // Explicit static imports only — never a glob. The reference
    // implementation records an out-of-memory failure during Next's "Collecting
    // page data" caused by exactly that, and a hosted build is the worst place
    // to find out. A file that exists and is not imported is a node that
    // silently does not run, so the rule is enforced without using the thing it
    // forbids.
    const source = barrelSource();
    const unimported = executorFiles().filter(
      (f) => !source.includes(`./${f.replace(/\.ts$/, "")}.js`),
    );
    expect(unimported).toEqual([]);
  });

  it("contains no glob or dynamic import", () => {
    const source = barrelSource();
    expect(source).not.toMatch(/import\.meta\.glob/);
    expect(source).not.toMatch(/require\.context/);
    expect(source).not.toMatch(/await import\(/);
  });
});

describe("definitions the engine relies on", () => {
  it("declares at-most-once on every node with a customer-visible side effect", () => {
    // `email.send` running twice is two emails to a customer. The engine writes
    // a `running` log row before invoking one of these and refuses to re-enter
    // it after a crash — but only if the definition says so.
    expect(getDefinition("email.send")?.sideEffect).toBe("at-most-once");
    expect(getDefinition("customer.addNote")?.sideEffect).toBe("at-most-once");
  });

  it("marks the email node's body for html encoding", () => {
    // The encoding is declared with the property, not chosen at the call site
    // (D-08). A customer's own last name reaches a React Email template through
    // this field.
    const body = getDefinition("email.send")?.properties.find((p) => p.name === "body");
    expect(body?.encoding).toBe("html");
  });

  it("leaves the email subject unencoded", () => {
    // `sanitizeSubject()` strips CR/LF/tab; html-encoding here would print
    // `&amp;` in somebody's inbox.
    const subject = getDefinition("email.send")
      ?.properties.find((p) => p.name === "subject");
    expect(subject?.encoding).toBe("none");
  });

  it("has no free-text recipient field on the email node", () => {
    // D-14. A free-text address field on an automation is an open relay with a
    // nice UI — anyone who can edit a workflow could mail anyone from the
    // tenant's verified sending domain, and complaints score against a domain
    // every tenant shares.
    const names = (getDefinition("email.send")?.properties ?? []).map((p) => p.name);
    expect(names).not.toContain("to");
    expect(names).not.toContain("email");
    expect(names).toContain("recipient");
  });

  it("marks every foreign-id property with an ownership kind", () => {
    // An id in a saved node config is client-supplied data exactly like a
    // request body, and there is no row-level security underneath it. The
    // engine re-checks anything carrying `ownership`; a property that holds an
    // id and does not declare one is never checked at all.
    const unguarded: string[] = [];

    for (const def of allDefinitions()) {
      for (const property of def.properties) {
        if (!property.type.endsWith("Select")) continue;
        // Picks a value, not a row: no id, nothing to own.
        if (property.type === "serviceTypeSelect") continue;
        // Picks another **step in this same graph**, not a tenant-scoped row.
        // There is no table to check it against, and the graph validator owns
        // the equivalent rule — `goto_target_missing` fires when the step it
        // points at has been deleted, which is the only way it can go wrong.
        if (property.type === "nodeSelect") continue;
        if (!property.ownership) unguarded.push(`${def.node}.${property.name}`);
      }
    }

    expect(unguarded).toEqual([]);
  });
});

/**
 * The definition↔executor parameter seam.
 *
 * A node's fields are declared in one package and read in another, joined only
 * by a string, and `params` is `Record<string, unknown>` — so `params.stopType`
 * against a field declared as `outcome` compiles perfectly and reads as correct
 * at both ends. What it does is return `undefined` forever, which every
 * executor here quite reasonably absorbs with a default.
 *
 * That is exactly how it shipped: `logic.stop` declared `outcome`, the executor
 * read `stopType`, and so **every** stop ended the run as "completed" no matter
 * which outcome the author picked — a step explicitly set to "Failed" finished
 * quietly and fired no failure notification. Same shape as the `trigger_types`
 * defect: two internally consistent halves and nothing asserting they meet.
 */
describe("executors read the fields their definitions declare", () => {
  /** Property names declared by a node, including ones inside `displayOptions`. */
  function declaredFields(nodeId: string): Set<string> {
    const def = getDefinition(nodeId);
    return new Set((def?.properties ?? []).map((p) => p.name));
  }

  it("no executor reads a parameter its definition does not declare", () => {
    const mismatches: string[] = [];

    for (const nodeId of mappedNodeIds()) {
      const file = join(EXECUTOR_DIR, moduleNameFor(nodeId));
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue; // "every active node is mapped to an executor" owns this case
      }

      // Comments stripped: this very test file's rationale mentions
      // `params.stopType`, and a docblock in an executor explaining a rename
      // must not read as a live access.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

      const declared = declaredFields(nodeId);
      const reads = new Set(
        [...code.matchAll(/params\.([A-Za-z_]\w*)/g)].map((m) => m[1]),
      );

      for (const field of reads) {
        if (!declared.has(field)) mismatches.push(`${nodeId} reads params.${field}`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});
