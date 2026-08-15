import type { NodeDefinition } from "../../node-definition.js";

/**
 * Remember a value for the rest of the run.
 *
 * Writes into `ctx.vars`, which every later step reads as `{{vars.name}}`. The
 * plumbing has existed since P3 — `ExecutionContext.vars` is documented as
 * *"written by `data.setFields`"* — and nothing wrote to it, so the namespace
 * resolved to nothing for every automation ever built.
 *
 * What it is actually for: computing something once and using it in three
 * messages, and giving a value a name the author chose rather than repeating a
 * long variable path they have to keep correct in four places.
 *
 * **Not persisted across a wait.** `ctx.vars` lives on the execution row and is
 * restored with it, so a value set before a three-day pause is still there
 * after. What is *not* restored is anything derived from a record that has since
 * changed — `restoreContext` re-reads the records, and that is deliberate.
 */
export default {
  node: "data.setFields",
  version: 1,
  displayName: "Remember a Value",
  description: "Store a value under a name the later steps can use.",
  howItWorks:
    "Anything you store here is available further down as {{vars.yourName}}. " +
    "Useful when the same value appears in several messages, or when a long " +
    "variable path is easier to read under a short name.",
  icon: "IconVariable",
  category: "data",
  subcategory: "data.transform",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  // Reads and writes run state only. No record is touched, so it needs no
  // subject and re-running it is free.
  sideEffect: "none",

  properties: [
    {
      displayName: "Values",
      name: "fields",
      type: "keyValue",
      required: true,
      typeOptions: {
        keyPlaceholder: "greeting",
        valuePlaceholder: "Hi {{customer.firstName}}",
        addButtonText: "Add another value",
      },
      description: "Each name becomes {{vars.name}} in the steps below.",
    },
  ],
} satisfies NodeDefinition;
