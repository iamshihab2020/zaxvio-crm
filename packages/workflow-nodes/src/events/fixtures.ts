/**
 * Test fixtures, generated **from** the schemas.
 *
 * ## Why this file exists instead of a folder of JSON
 *
 * The most expensive bug in the system this was ported from survived for months
 * behind a passing unit test. The producer emitted `pipeline_stage_id`; the
 * consumer read `stageId`; the test hand-wrote a camelCase fixture that
 * production never emitted, agreed with the consumer, and went green. The test
 * was not merely useless — it was actively load-bearing evidence that the thing
 * worked.
 *
 * A fixture typed by hand is a **second** declaration of the payload shape, and
 * a second declaration drifts. So there is exactly one: the schema. Everything
 * below derives from it, which means a field added to a payload appears in every
 * fixture on the next run, and a field renamed breaks every test that referenced
 * the old name — immediately, at the name, which is the whole point.
 *
 * ## How a field gets its sample value
 *
 * In order: an `example` in the field's own `.meta()`, then a default for the
 * primitive type. A field whose shape a generator cannot guess — anything
 * regex-constrained — carries its example on the shared definition in
 * `shared.ts`, so it is still one declaration.
 *
 * If neither works, `buildEventFixture` **throws with the failing path**. It
 * cannot return an invalid fixture, because a fixture that does not parse is
 * indistinguishable from the bug this file exists to catch.
 */

import { z } from "zod";
import {
  requireEventDefinition,
  WORKFLOW_EVENTS,
  type EventPayloadFor,
  type WorkflowEventType,
} from "./registry.js";

/**
 * Zod's internals, reached deliberately.
 *
 * `def` carries the discriminator this generator walks (`optional`, `object`,
 * `enum`, …) and Zod types it as `$ZodTypeDef`, which describes the union rather
 * than any one member. This is the narrower view this file actually reads.
 */

/**
 * Deterministic. Never `Math.random()` or `Date.now()` — a fixture that differs
 * between runs turns a real failure into a flake, and the test harness forbids
 * both anyway.
 */
const DEFAULTS = {
  string: "sample",
  number: 1,
  int: 1,
  boolean: true,
  bigint: 1n,
  date: new Date("2026-08-07T13:00:00.000Z"),
} as const;

interface ZodDefLike {
  type?: string;
  innerType?: z.ZodType;
  element?: z.ZodType;
  entries?: Record<string, string | number>;
  values?: unknown[];
  checks?: { _zod?: { def?: { check?: string; format?: string; minimum?: number } } }[];
  defaultValue?: unknown;
  shape?: Record<string, z.ZodType>;
  options?: z.ZodType[];
}

/**
 * Narrowed at runtime rather than asserted.
 *
 * These three helpers used to be `as unknown as { … }` double casts, which is
 * banned by strict-rules §4 and was hiding something: a cast asserts the
 * property is there, an `in` check *asks*. Writing the question out is what
 * showed that `meta()` had been public API on `z.ZodType` all along — the cast
 * was working around a type that already fit.
 */
function hasDef(schema: object): schema is { def: ZodDefLike } {
  return "def" in schema;
}

function hasShape(schema: object): schema is { shape: Record<string, z.ZodType> } {
  return "shape" in schema;
}

function defOf(schema: z.ZodType): ZodDefLike {
  return hasDef(schema) ? schema.def : {};
}

/**
 * The `example` a field declares through `.meta({ example })`.
 *
 * Zod's `GlobalMeta` does not declare `example` — it is this project's own key —
 * so the value is reached with an `in` check rather than by widening the return
 * type, which would be a second declaration of a shape Zod already owns.
 */
function exampleOf(schema: z.ZodType): unknown {
  const meta = schema.meta();
  return meta && "example" in meta ? meta.example : undefined;
}

function checkFormats(def: ZodDefLike): string[] {
  return (def.checks ?? [])
    .map((c) => c._zod?.def?.format)
    .filter((f): f is string => typeof f === "string");
}

function minLength(def: ZodDefLike): number {
  for (const c of def.checks ?? []) {
    if (c._zod?.def?.check === "min_length" && typeof c._zod.def.minimum === "number") {
      return c._zod.def.minimum;
    }
  }
  return 0;
}

/**
 * One sample value for one schema node.
 *
 * `path` is threaded purely so a failure can name the field. A generator that
 * says "invalid fixture" without saying which key is a worse debugging
 * experience than no generator.
 */
function sampleFor(schema: z.ZodType, path: string): unknown {
  const explicit = exampleOf(schema);
  if (explicit !== undefined) return explicit;

  const def = defOf(schema);

  switch (def.type) {
    // Wrappers — unwrap and keep going. A nullable field samples its *value*,
    // not null: a fixture full of nulls exercises nothing.
    case "optional":
    case "nullable":
    case "readonly":
    case "nonoptional":
      return def.innerType ? sampleFor(def.innerType, path) : undefined;

    case "default":
    case "prefault":
      return typeof def.defaultValue === "function"
        ? (def.defaultValue as () => unknown)()
        : (def.defaultValue ??
            (def.innerType ? sampleFor(def.innerType, path) : undefined));

    case "object": {
      const shape = hasShape(schema) ? schema.shape : (def.shape ?? {});
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(shape)) {
        const value = sampleFor(child, path ? `${path}.${key}` : key);
        // An optional field that produced nothing is simply omitted — that is
        // what optional means, and writing `undefined` into it would fail a
        // `.strict()` parse on some Zod versions.
        if (value !== undefined) out[key] = value;
      }
      return out;
    }

    case "array": {
      if (!def.element) return [];
      const min = Math.max(minLength(def), 1);
      return Array.from({ length: min }, (_, i) =>
        sampleFor(def.element as z.ZodType, `${path}[${i}]`),
      );
    }

    case "enum": {
      const values = Object.values(def.entries ?? {});
      if (values.length === 0) throw fixtureError(path, "enum has no members");
      return values[0];
    }

    case "literal": {
      const values = def.values ?? [];
      if (values.length === 0) throw fixtureError(path, "literal has no value");
      return values[0];
    }

    case "union": {
      const options = def.options ?? [];
      if (options.length === 0) throw fixtureError(path, "union has no options");
      return sampleFor(options[0], path);
    }

    case "string": {
      const formats = checkFormats(def);
      if (formats.includes("uuid")) return "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
      if (formats.includes("datetime")) return "2026-08-07T13:00:00.000Z";
      if (formats.includes("email")) return "sample@example.com";
      if (formats.includes("url")) return "https://example.com";
      if (formats.includes("regex")) {
        // Reversing an arbitrary regex is not a thing. Declare the example on
        // the field — in `shared.ts` if it is shared, inline if it is not.
        throw fixtureError(
          path,
          "is regex-constrained and has no `.meta({ example })`. Add one to the " +
            "field definition so the fixture and the field stay one declaration.",
        );
      }
      return DEFAULTS.string;
    }

    case "number":
      return DEFAULTS.number;
    case "int":
      return DEFAULTS.int;
    case "boolean":
      return DEFAULTS.boolean;
    case "bigint":
      return DEFAULTS.bigint;
    case "date":
      return DEFAULTS.date;
    case "null":
      return null;
    case "any":
    case "unknown":
      return {};
    case "record":
      return {};

    default:
      throw fixtureError(
        path,
        `has unsupported Zod type "${def.type ?? "unknown"}". Either use a ` +
          `supported primitive or give the field a \`.meta({ example })\`.`,
      );
  }
}

function fixtureError(path: string, message: string): Error {
  return new Error(`Cannot generate a fixture: \`${path || "(root)"}\` ${message}`);
}

/**
 * A valid payload for one event, derived from its schema and **verified against
 * it** before being returned.
 *
 * `overrides` is a shallow merge for the field a test actually cares about —
 * "a job whose margin is 4%" is one key, not a whole hand-typed object. The
 * result is parsed after merging, so an override that breaks the schema fails
 * here rather than three assertions later.
 */
export function buildEventFixture<T extends WorkflowEventType>(
  type: T,
  overrides: Partial<EventPayloadFor<T>> = {},
): EventPayloadFor<T> {
  const def = requireEventDefinition(type);
  const generated = sampleFor(def.payload, "");

  const merged =
    generated !== null && typeof generated === "object" && !Array.isArray(generated)
      ? { ...(generated as Record<string, unknown>), ...overrides }
      : generated;

  const result = def.payload.safeParse(merged);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Generated fixture for "${type}" does not satisfy its own schema:\n${issues}\n` +
        `This is a bug in the schema or in the generator, never a reason to hand-write the fixture.`,
    );
  }
  return result.data as EventPayloadFor<T>;
}

/**
 * Every event's fixture, built in one pass.
 *
 * The registry test calls this: if any single event's schema cannot produce a
 * valid sample, the whole suite fails with that event named. Adding an event
 * without a producible payload is therefore not something that can reach main.
 */
export function buildAllEventFixtures(): Record<WorkflowEventType, unknown> {
  const out = {} as Record<WorkflowEventType, unknown>;
  const failures: string[] = [];
  for (const type of Object.keys(WORKFLOW_EVENTS) as WorkflowEventType[]) {
    try {
      out[type] = buildEventFixture(type);
    } catch (err) {
      failures.push(`${type}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Fixture generation failed for ${failures.length} event(s):\n${failures.join("\n")}`);
  }
  return out;
}
