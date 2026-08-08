import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_NODES,
  allDefinitions,
  getDefinition,
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

function executorFiles(): string[] {
  return readdirSync(EXECUTOR_DIR)
    .filter((f) => statSync(join(EXECUTOR_DIR, f)).isFile())
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => f !== "index.ts" && f !== "types.ts");
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
});

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
        if (!property.ownership) unguarded.push(`${def.node}.${property.name}`);
      }
    }

    expect(unguarded).toEqual([]);
  });
});
