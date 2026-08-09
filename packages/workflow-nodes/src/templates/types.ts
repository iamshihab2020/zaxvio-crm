/**
 * The template contract.
 *
 * A template is a **declaration**, not code that builds a graph. That matters
 * for the same reason node definitions are declarations: the gallery has to
 * render it, the server has to instantiate it, and a test has to check it would
 * actually publish. A function returning nodes could only be run, not inspected.
 *
 * ## Local keys, never ids
 *
 * Nodes here are joined by a `key` the template author picks — `"trigger"`,
 * `"wait"`, `"email"`. Real UUIDs are minted at instantiation, because two
 * automations created from one template must not share node ids: node id is
 * what an edge stores, what a run log points at, and what "run from here" would
 * resume from. Baking a uuid into a template would make every copy of it the
 * same automation as far as those are concerned.
 */

/** The gallery's shelves. Ordered here, so the gallery has no list of its own. */
export const TEMPLATE_CATEGORIES = [
  "getting-paid",
  "winning-work",
  "keeping-customers",
  "staying-on-top",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateNode {
  /** Local to this template. Mapped to a fresh UUID at instantiation. */
  key: string;
  nodeType: string;
  /**
   * The name shown on the canvas. Worth setting on every node: a template whose
   * steps all read "Send Email" teaches nothing, and the label is the only place
   * a template can explain *why* a step is there.
   */
  label?: string;
  parameters: Record<string, unknown>;
  /**
   * Lay this node out below its siblings rather than in line — used for the
   * second branch of a condition. Layout is otherwise derived.
   */
  branchIndex?: number;
}

export interface TemplateEdge {
  from: string;
  /** Stable output id, never a display label (D-07). Defaults to `main`. */
  fromHandle?: string;
  to: string;
}

export interface WorkflowTemplate {
  /**
   * Stable and permanent. It is recorded on the workflow it creates, so
   * renaming one orphans that record — the same rule as a node id.
   */
  id: string;
  /** The automation's name when created. What the tenant sees in their list. */
  name: string;
  /** One line, in the outcome's language rather than the mechanism's. */
  summary: string;
  /**
   * What it does, step by step, for the gallery card's expanded view. Written
   * for somebody deciding whether they want it, not documenting how it works.
   */
  detail: string;
  category: TemplateCategory;
  /** Resolved through the same curated icon map as nodes. */
  icon: string;
  /**
   * Steps the tenant has to finish before this can publish.
   *
   * A template that cannot publish as delivered is worse than no template — it
   * drops somebody into a builder full of red badges for a graph they did not
   * draw. So the honest ones say so on the card, and **a test asserts the list
   * is accurate**: the graph's missing required fields must be exactly the ones
   * claimed. A list that drifts is the "there are 0 things to fix first" defect
   * wearing a different hat.
   */
  needsSetup?: string[];
  /**
   * Tenant *settings* this leans on, which is a different thing entirely.
   *
   * `{{tenant.googleReviewUrl}}` is not a field on any step — it is a value in
   * Settings → Business, and the automation publishes perfectly well without it.
   * It just sends a button that goes nowhere, which is the kind of failure
   * nobody notices until a customer mentions it.
   *
   * Deliberately not assertable: it is about state in the database at run time,
   * not about the graph. Keeping it separate from `needsSetup` is what lets that
   * one be asserted.
   */
  dependsOn?: string[];
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}
