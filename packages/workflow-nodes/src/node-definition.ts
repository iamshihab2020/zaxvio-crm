/**
 * The node definition contract — the load-bearing idea of the whole feature.
 *
 * One declaration per node type, consumed by THREE places that must agree:
 *   - the builder, which renders a config form from `properties[]`
 *   - the engine, which reads `mutates` / `sideEffect` / `noInterpolate` and
 *     dispatches to an executor keyed by `node`
 *   - the validator, which runs in both
 *
 * Behaviour lives nowhere near here. A definition declares *what a node is
 * configured with*; an executor implements *what it does*. The link is the
 * `node` string. That separation is why adding a node is "write a definition,
 * write one function" instead of touching six files.
 *
 * This is n8n's `INodeTypeDescription` with four Zaxvio-specific additions,
 * each marked below. See docs/workflow-automation/wf-04-node-catalog.md §4.1.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a run is *about*. Polymorphic on purpose (wf-00 D-02): this is service
 * management, so an automation is as often about a job or an invoice as about
 * a customer. The reference implementation hard-coded `contact_id` and needed a
 * second nullable column the moment a second subject appeared.
 */
export const SUBJECT_TYPES = [
  "customer",
  "job",
  "invoice",
  "quote",
  "booking",
  "equipment",
  "maintenance_contract",
] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const NODE_CATEGORIES = [
  "trigger",
  "communication",
  "crm",
  "logic",
  "data",
  "integration",
] as const;
export type NodeCategory = (typeof NODE_CATEGORIES)[number];

/**
 * Field types the config panel knows how to render. This list is the real API
 * surface of the builder — every entry is UI work, so it grows deliberately.
 *
 * The first block covers every logic, data and communication node. The second
 * block is what makes the builder feel native rather than like an embedded
 * Zapier: a "Stage" dropdown that lists *this tenant's* stages.
 */
export const NODE_PROPERTY_TYPES = [
  // primitives + choice (P5)
  "string",
  "text",
  "number",
  "boolean",
  "options",
  "multiOptions",
  "date",
  "time",
  "duration",
  "keyValue",
  "notice",
  // CRM pickers (P7)
  "customerSelect",
  "jobSelect",
  "pipelineSelect",
  "stageSelect",
  "catalogItemSelect",
  "checklistSelect",
  "tagSelect",
  "multiTagSelect",
  "memberSelect",
  "serviceTypeSelect",
  "emailTemplateSelect",
  "workflowSelect",
  "moneyInput",
] as const;
export type NodePropertyType = (typeof NODE_PROPERTY_TYPES)[number];

/**
 * One closed operator set, shared by trigger filters, `condition.if` and goal
 * filters. Closed because an open one is how a filter ends up silently not
 * applying — and because a single set means one matrix test covers all of it.
 */
export const FILTER_OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "between",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
  "inList",
  "notInList",
  "dateBefore",
  "dateAfter",
  "dateWithinNext",
  "dateWithinLast",
  "isToday",
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/**
 * Which foreign key a property holds, so it can be tenant-checked.
 *
 * A node config's `pipelineId` is client-supplied data exactly like a request
 * body, and there is no row-level security underneath it (wf-10 §10.1). Checked
 * twice: at save time so the user is told, and at execution time because rows
 * get deleted and automations get duplicated.
 */
export const OWNERSHIP_KINDS = [
  "customer",
  "job",
  "pipeline",
  "stage",
  "catalogItem",
  "checklist",
  "equipment",
  "contract",
  "member",
  "tag",
  "workflow",
] as const;
export type OwnershipKind = (typeof OWNERSHIP_KINDS)[number];

/** Where an interpolated value is about to land. Declared with the field, not
 *  remembered at each call site — the reference implementation chose it per
 *  call and a node that forgot silently got `none`. */
export type EncodingContext = "none" | "html" | "url";

/**
 * Whether a node is safe to re-enter after a crash or a resume.
 *
 *   none          — reads only
 *   idempotent    — running it twice leaves the same state (set a stage, add a tag)
 *   at-most-once  — running it twice is visible to a customer (send an email)
 *
 * The engine writes a `running` node-log row before invoking an at-most-once
 * executor; a resume that finds one refuses rather than sending twice.
 */
export type SideEffectKind = "none" | "idempotent" | "at-most-once";

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

export interface NodePropertyOption {
  name: string;
  value: string | number | boolean;
  description?: string;
}

export interface NodePropertyTypeOptions {
  /** `text` — rows in the textarea. */
  rows?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  /** `keyValue` */
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonText?: string;
  /** `notice` — display-only callout, carries no value. */
  noticeType?: "info" | "warning" | "error";
  noticeMessage?: string;
  /**
   * Dependent pickers: `stageSelect` reads the sibling `pipelineId` so the
   * stage list is filtered to the chosen pipeline. Names a sibling property.
   */
  dependsOn?: string;
  /** `duration` — which units to offer. */
  units?: ("minutes" | "hours" | "days" | "weeks")[];
}

/** Conditional rendering, lifted from n8n. Without it an 8-property email node
 *  is an unusable wall of inputs. */
export interface NodeDisplayOptions {
  show?: Record<string, (string | number | boolean)[]>;
  hide?: Record<string, (string | number | boolean)[]>;
}

/**
 * Declarative trigger filtering (wf-00 D-09).
 *
 * The reference implementation hand-codes filters per event family across 3,146
 * lines, so adding a filter to one trigger gives it to no other and a missing
 * branch means a filter the user configured does nothing at all. Declaring it
 * here means one generic evaluator serves every trigger, forever.
 */
export interface NodePropertyFilter {
  /** Dot path into the *typed* event payload, e.g. "toLifecycle". */
  path: string;
  operator: FilterOperator;
  /** Default "event". "subject" reads the loaded subject instead. */
  source?: "event" | "subject";
}

export interface NodeProperty {
  displayName: string;
  /** The key written into `node_config.parameters`. Unique within the node. */
  name: string;
  type: NodePropertyType;
  required?: boolean;
  /**
   * Seeded into `node_config.parameters` at node creation, by the single node
   * constructor. The UI default and the runtime default must never be two
   * separate declarations — that is how the reference implementation ended up
   * with a dropdown showing a pre-selected value it never persisted.
   */
  default?: unknown;
  placeholder?: string;
  description?: string;
  hint?: string;

  options?: NodePropertyOption[];
  typeOptions?: NodePropertyTypeOptions;
  displayOptions?: NodeDisplayOptions;

  // ── engine-side declarations ───────────────────────────────────────────────
  filter?: NodePropertyFilter;
  encoding?: EncodingContext;
  /** Skip `{{token}}` resolution for this field (regex patterns, raw bodies). */
  noInterpolate?: boolean;
  /** This value is a foreign id and must be tenant-checked. */
  ownership?: OwnershipKind;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs / outputs
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeInput {
  id: string;
  label?: string;
}

/**
 * `id` and `label` are SEPARATE, and `id` is what an edge stores.
 *
 * The reference implementation puts the *display label* in `sourceHandle`, so
 * renaming "Found" to "Match" breaks routing on every saved automation. Edges
 * here carry `source_handle = "found"` and the label is free to change.
 */
export interface NodeOutput {
  id: string;
  label: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The definition
// ─────────────────────────────────────────────────────────────────────────────

export type NodeTag = "beta" | "new" | "deprecated" | "coming-soon";

export interface NodeDefinition {
  /**
   * UNIQUE and IMMUTABLE. Persisted on every saved node, so a rename orphans
   * every automation that used it. Enforced by a test asserting the committed
   * id set only ever grows.
   *
   * Format: `domain.verb`, lowerCamel segments — `job.moveStage`. Also
   * lint-enforced, because the reference implementation froze one snake_case id
   * among dotted ones forever and could never fix it.
   */
  node: string;
  version: number;

  displayName: string;
  description: string;
  /** Rendered above the form. Users open a config panel not knowing what the
   *  node does; one or two sentences fixes that for the price of a string. */
  howItWorks?: string;

  /** Resolved through a curated name → component map. NEVER a wildcard import
   *  from an icon library — that OOMs the Next build during page collection. */
  icon: string;
  category: NodeCategory;
  subcategory?: string;
  /** Overrides the subcategory/category colour. Rarely correct to set. */
  color?: string;

  inputs: NodeInput[];
  outputs: NodeOutput[];

  properties: NodeProperty[];

  // ── runtime declarations ──────────────────────────────────────────────────
  /** What this node changes, so the engine knows what to re-read and which
   *  analytics cache to invalidate. Engine writes have no request, so the
   *  server's onResponse cache hook never fires for them. */
  mutates?: SubjectType[];
  sideEffect?: SideEffectKind;
  /** Trigger nodes only: which events start this automation. */
  triggerEvents?: string[];
  /** Subject types this node can act on. The validator uses it to say "this
   *  action needs a job, and your trigger provides a customer" at publish time
   *  rather than in a failed run three weeks later. */
  requiresSubject?: SubjectType[];

  tags?: NodeTag[];
  /** Never appears in the palette, in any environment. */
  devOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** `domain.verb` in lowerCamel, at least two segments. */
export const NODE_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

export function isTriggerNode(def: NodeDefinition): boolean {
  return def.category === "trigger";
}

/**
 * Required properties with no value.
 *
 * A pure function of (node, definition) so the builder can render a live ⚠
 * badge and the validator can block a publish, from one implementation. Note
 * that `false` and `0` are values — treating them as empty is how a
 * "minimum total: 0" filter ends up silently ignored.
 *
 * **A hidden field is never missing.** `displayOptions` is what makes an
 * eight-property node usable, and a required property the form is not showing
 * is one the author has no way to fill: choosing "Plain text" hides the HTML
 * body, and without this check Publish would be blocked forever on a field that
 * does not appear anywhere on screen. `isPropertyVisible` is documented as
 * being shared with the validator for exactly this reason — it just was not
 * being called.
 */
export function getMissingRequiredFields(
  def: NodeDefinition,
  parameters: Record<string, unknown>,
): string[] {
  return def.properties
    .filter((p) => p.required && p.type !== "notice")
    .filter((p) => isPropertyVisible(p, parameters))
    .filter((p) => isBlank(parameters[p.name]))
    .map((p) => p.name);
}

/** Blank means "the user has not supplied this". `0` and `false` are values. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Whether a property should render, given its siblings' current values.
 *
 * `hide` wins over `show`, matching n8n. Shared by the config renderer and the
 * validator so a hidden required field never blocks a publish.
 */
export function isPropertyVisible(
  property: NodeProperty,
  parameters: Record<string, unknown>,
): boolean {
  const opts = property.displayOptions;
  if (!opts) return true;

  if (opts.hide) {
    for (const [key, values] of Object.entries(opts.hide)) {
      if (values.includes(parameters[key] as string | number | boolean)) return false;
    }
  }
  if (opts.show) {
    for (const [key, values] of Object.entries(opts.show)) {
      if (!values.includes(parameters[key] as string | number | boolean)) return false;
    }
  }
  return true;
}
