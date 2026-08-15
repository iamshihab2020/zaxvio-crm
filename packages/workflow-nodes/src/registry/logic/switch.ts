import type { NodeDefinition } from "../../node-definition.js";

/**
 * Send the run down one of several routes, by what a value is.
 *
 * ## Why this is not "several Only ifs in a row"
 *
 * It is, functionally — and that is the point. A four-way split built from
 * chained `condition.if` nodes is seven steps on the canvas, four of which
 * restate the same variable, and adding a fifth case means re-wiring the tail.
 * The shape a service business actually wants ("do this per service type", "do
 * this per priority") is a table, so this is a table.
 *
 * ## Exclusive, and the first match wins
 *
 * `outputMode: "exclusive"` — exactly one route runs. That is what makes it
 * different from `split.branch`, which runs all of them, and it is a declaration
 * rather than something the validator infers from output count: the engine
 * already knew the difference while the validator was guessing, which is how
 * `merge_never_completes` came to refuse the only shape a merge is for.
 *
 * Routes are evaluated **in order**, so an author can put the specific case
 * above the general one. Reordering is meaningful, which is why the field is a
 * list rather than a set.
 *
 * ## The fallback is opt-in and its absence is silent by design
 *
 * With no fallback, a value matching no route ends that branch — no error, no
 * failure. A Switch is a routing table, and "none of these applied" is a normal
 * answer to a routing question. Making it an error would mean every Switch over
 * an open-ended value needed an Otherwise branch that did nothing, just to
 * publish.
 */
export default {
  node: "logic.switch",
  version: 1,
  displayName: "Choose a Route",
  description: "Send the run one way or another depending on a value.",
  howItWorks:
    "Give it a value and a list of things that value might be. The run takes " +
    "the first route that matches, and only that one. Turn on Otherwise to " +
    "catch anything that matches nothing.",
  icon: "IconArrowsSplit2",
  category: "logic",
  subcategory: "logic.branch",

  inputs: [{ id: "main" }],
  // Static outputs are empty on purpose. Every output this node has depends on
  // its configuration, so `def.outputs` alone would read as *zero* outputs —
  // which is why nothing may read it directly and `outputsFor()` is the only
  // way to ask.
  outputs: [],
  outputMode: "exclusive",

  dynamicOutputs: (parameters) => {
    const configured = Array.isArray(parameters.routes) ? parameters.routes : [];
    // **A floor of one, never zero.** A node with no outputs cannot be
    // connected to anything: the palette wires nothing after it and the canvas
    // renders a dead end, on a step whose entire job is to choose where to go.
    // `split.branch` has the same floor through `branchCount`, and this one
    // matters more — its routes are a list the author edits, so "empty" is the
    // state every Switch passes through on the way to being configured.
    const routes = configured.length > 0 ? configured : [{}];
    const outputs = routes.map((route, index) => {
      const value =
        route && typeof route === "object"
          ? (route as { value?: unknown }).value
          : undefined;
      return {
        // A **stable id keyed on position**, never on the value. Renaming a
        // route's value must not re-route every saved edge — that is D-07, and
        // the reference implementation stored the label in `sourceHandle` and
        // broke routing on every automation whenever a branch was renamed.
        id: `route${index}`,
        label:
          typeof value === "string" && value.trim()
            ? value.trim()
            : `Route ${index + 1}`,
      };
    });

    if (parameters.fallback === true) {
      outputs.push({ id: "otherwise", label: "Otherwise" });
    }
    return outputs;
  },

  sideEffect: "none",

  properties: [
    {
      displayName: "Look at",
      name: "variable",
      // Stores a bare path, not a `{{token}}`. Interpolation renders variables
      // *for people* — `{{job.serviceType}}` could come back title-cased — and
      // routing on a display string is the "guess the format from the value"
      // mistake the interpolator refuses to make. The executor resolves the raw
      // value instead.
      type: "variablePath",
      required: true,
      description: "The value to route on — a job's service type, an invoice's status.",
    },
    {
      displayName: "Routes",
      name: "routes",
      type: "keyValue",
      required: true,
      // Seeded so a fresh Switch has one row to fill in rather than an empty
      // table with an Add button. The UI default and the runtime default are
      // one declaration — the reference implementation had a dropdown showing a
      // pre-selected value it never persisted.
      default: [{ key: "", value: "" }],
      typeOptions: {
        keyPlaceholder: "Name this route",
        valuePlaceholder: "The value it should match",
        addButtonText: "Add another route",
      },
      description:
        "Checked top to bottom — the first match wins, so put the specific ones first.",
    },
    {
      displayName: "Add an Otherwise route",
      name: "fallback",
      type: "boolean",
      default: false,
      description:
        "Without it, a value matching nothing simply ends that branch — which is often what you want.",
    },
  ],
} satisfies NodeDefinition;
