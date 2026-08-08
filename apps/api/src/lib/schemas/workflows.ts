import { z } from "zod";
import {
  EXECUTION_LIMITS,
  NODE_ID_PATTERN,
  SUBJECT_TYPES,
} from "@hvac-saas/workflow-nodes";
import { booleanFlag, boundedText, paginationQuery } from "./common.js";

/**
 * Schemas for the workflow surface.
 *
 * P3 shipped two endpoints — run by hand, read quota. P5 adds the builder's,
 * which are the ones that accept a graph, and a graph is the largest and least
 * structured body in the product. Every bound here exists because the payload
 * is client-authored and lands in `jsonb`, where nothing downstream will
 * complain about a 4 MB label.
 */

/**
 * The subject enum mirrors `SUBJECT_TYPES` from the package rather than
 * repeating it. A Zod enum needs a non-empty tuple, hence the destructure —
 * a spread alone types as `string[]` and `z.enum` refuses it.
 */
const [firstSubject, ...restSubjects] = SUBJECT_TYPES;
export const subjectTypeSchema = z.enum([firstSubject, ...restSubjects]);

export const runWorkflowBody = z.object({
  /**
   * What to run it on. Optional, because a manual trigger configured for no
   * subject is legitimate — "send me the weekly summary" needs no record.
   */
  subject: z
    .object({
      type: subjectTypeSchema,
      id: z.string().uuid(),
    })
    .optional(),
  /**
   * Run against a specific published version rather than the active one.
   *
   * For replaying a run against the graph it originally used. **Not** a way to
   * run a draft: a version id only exists once something has been published,
   * which is the point of D-06 — drawing is not publishing.
   */
  versionId: z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// The workflow record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 'tenant' resolves `tenants.timezone`; 'custom' uses the workflow's own.
 * A datetime that falls back to the server zone is the most damaging class of
 * automation bug there is — a reminder in the wrong timezone is a missed
 * appointment — so the mode is explicit rather than inferred from whether the
 * timezone column happens to be null.
 */
export const timezoneModeSchema = z.enum(["tenant", "custom"]);

export const createWorkflowBody = z.object({
  name: boundedText(120).min(1, "Give this automation a name"),
  description: boundedText(2000).nullish(),
  folderId: z.string().uuid().nullish(),
  timezoneMode: timezoneModeSchema.default("tenant"),
  /** IANA zone. Only meaningful when `timezoneMode` is 'custom'. */
  timezone: boundedText(64).nullish(),
  templateKey: boundedText(120).nullish(),
});

/**
 * `isActive` is **absent** from this body on purpose.
 *
 * Switching an automation on is not a field edit — it is the moment it starts
 * touching customers, and it is refused outright until something has been
 * published ([[wf-08-builder-frontend|§8.6]]). It gets its own endpoint so that
 * rule lives in one handler rather than as a conditional inside a generic PATCH.
 */
export const updateWorkflowBody = z
  .object({
    name: boundedText(120).min(1).optional(),
    description: boundedText(2000).nullish(),
    folderId: z.string().uuid().nullish(),
    timezoneMode: timezoneModeSchema.optional(),
    timezone: boundedText(64).nullish(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Nothing to update",
  });

export const setWorkflowActiveBody = z.object({
  isActive: z.boolean(),
});

export const workflowListQuery = paginationQuery.extend({
  isActive: booleanFlag.optional(),
  folderId: z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// The graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `node_config`.
 *
 * `parameters` is deliberately open — its keys are `NodeProperty.name` from
 * whichever definition this node is, so no fixed schema could describe it, and
 * a per-node-type discriminated union would put the registry inside the request
 * validator. Per-field meaning is enforced where it is known: the graph
 * validator checks required fields against the definition, and the engine
 * interpolates and coerces at execution.
 *
 * What *is* enforced here is size, because this lands in `jsonb`.
 */
export const nodeConfigSchema = z.object({
  label: boundedText(120),
  parameters: z.record(z.string().max(80), z.unknown()),
  disabled: z.boolean().optional(),
});

/**
 * Canvas coordinates. Bounded because they are written straight to an `integer`
 * column — an unbounded number overflows int4 and fails the insert with a
 * Postgres error nobody can act on, and no real canvas is a million units wide.
 */
const coordinate = z.number().min(-1_000_000).max(1_000_000);

export const graphNodeSchema = z.object({
  /** Client-minted. The save contract sends the whole graph and diffs by id. */
  id: z.string().uuid(),
  nodeType: z
    .string()
    .max(100)
    .regex(NODE_ID_PATTERN, "Not a valid node type"),
  nodeConfig: nodeConfigSchema,
  positionX: coordinate,
  positionY: coordinate,
});

export const graphEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  /**
   * A stable handle id, never the display label — renaming a branch must not
   * break routing on every saved automation ([[wf-00-decisions|D-07]]).
   */
  sourceHandle: boundedText(60).default("main"),
  targetNodeId: z.string().uuid(),
  label: boundedText(120).nullish(),
});

/**
 * Edges are capped well above nodes rather than at the same number.
 *
 * A 60-node graph is not 60 edges: branching nodes have several outputs and
 * converging branches give a node several inputs. The cap exists to bound the
 * payload, not to express a graph rule — the validator owns those.
 */
const MAX_EDGES = 240;

export const saveGraphBody = z.object({
  nodes: z.array(graphNodeSchema).max(EXECUTION_LIMITS.MAX_NODES_PER_WORKFLOW),
  edges: z.array(graphEdgeSchema).max(MAX_EDGES),
  /**
   * The `updatedAt` the client last saw, echoed back.
   *
   * Required, with no default and no "force" escape hatch. A save that may omit
   * its concurrency token is a save that will omit it — and the thing being
   * overwritten here is not a field, it is somebody's whole automation
   * ([[wf-08-builder-frontend|S-6]]).
   */
  expectedUpdatedAt: z.coerce.date(),
});

export const nodeParam = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
});

export const previewNodeBody = z.object({
  /**
   * Which record to resolve against. Optional, because a step under a manual
   * trigger with no subject is legitimate — the preview then shows which
   * variables would come out empty, which is itself the useful answer.
   */
  subject: z
    .object({ type: subjectTypeSchema, id: z.string().uuid() })
    .optional(),
});

export const publishWorkflowBody = z.object({
  /** What changed, in the publisher's words. Shown in version history. */
  note: boundedText(500).nullish(),
});


// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

export const executionStatusSchema = z.enum([
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
]);

export const executionSourceSchema = z.enum([
  "event",
  "manual",
  "test",
  "webhook",
  "schedule",
  "sub",
  "replay",
]);

/**
 * The run list.
 *
 * `status` accepts a comma-separated set rather than one value, because the
 * question a person actually asks is "show me everything that did not go
 * cleanly" — failed *and* cancelled *and* still waiting. One value per request
 * would make that three requests merged in the browser, which is how a page
 * ends up with a total that disagrees with its own rows.
 */
export const runListQuery = paginationQuery.extend({
  status: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(executionStatusSchema).min(1).max(5).optional()),
  /** "Which automations touched this customer" — the index is already there. */
  customerId: z.string().uuid().optional(),
});

export const runIdParam = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
});
