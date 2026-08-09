import type { NodeDefinition } from "../../node-definition.js";

/**
 * Branch on a condition — the first node in the registry with two outputs.
 *
 * Until this shipped every automation was a straight line: you could filter at
 * the trigger, but not decide anything once running. "Chase harder if the
 * invoice is over $500" was unexpressible.
 *
 * The rules use the **same closed operator set as trigger filters**, evaluated
 * by the same function. One matrix test covers filtering everywhere in the
 * product, and "is empty" means one thing wherever a user meets it.
 *
 * Handle ids are `true` and `false`; the labels are "Yes" and "No". They are
 * separate on purpose — an edge stores the id, so the labels can be reworded
 * without breaking routing on every saved automation (D-07).
 */
export default {
  node: "condition.if",
  version: 1,
  displayName: "Only If",
  description: "Send the automation down one path or the other.",
  howItWorks:
    "Checks what you set below against the record this automation is running on. " +
    "Anything that comes out true goes down Yes, everything else down No — " +
    "including cases the check could not answer, so nothing slips through by accident.",
  icon: "IconArrowsSplit",
  category: "logic",
  subcategory: "logic.branch",

  inputs: [{ id: "main" }],
  outputs: [
    { id: "true", label: "Yes", description: "Everything the check matched." },
    { id: "false", label: "No", description: "Everything else." },
  ],

  sideEffect: "none",

  properties: [
    {
      displayName: "Continue down Yes when",
      name: "combinator",
      type: "options",
      required: true,
      default: "and",
      options: [
        { name: "every check passes", value: "and" },
        { name: "any check passes", value: "or" },
      ],
    },
    {
      displayName: "Checks",
      name: "rules",
      // An ARRAY, so an unconfigured node is genuinely blank and Publish
      // refuses it. An object would pass `isBlank` while holding no rules at
      // all, and a condition with nothing in it sends everything down one side.
      type: "conditions",
      required: true,
      description:
        "Each check compares something about the record to a value you set.",
    },
  ],
} satisfies NodeDefinition;
