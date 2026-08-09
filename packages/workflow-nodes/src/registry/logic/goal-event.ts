import type { NodeDefinition, NodePropertyOption } from "../../node-definition.js";
import { WORKFLOW_EVENTS } from "../../events/registry.js";

/**
 * Events a goal may watch for.
 *
 * Derived from the event registry rather than typed out, so a goal can never
 * offer an event nothing raises — the exact defect that shipped
 * `trigger.invoice.overdue` active with no producer, buildable and permanently
 * silent. Two filters:
 *
 *  - **`subject !== null`.** A goal is always about a record. `schedule.*` is
 *    about nothing and could never match a run.
 *  - **`phase !== "P9"`.** P9 events have no producer yet. The registry's own
 *    `phase` field said so about `invoice.overdue` the whole time and nothing
 *    read it; this reads it.
 */
export const GOAL_EVENT_OPTIONS: NodePropertyOption[] = Object.entries(WORKFLOW_EVENTS)
  .filter(([, def]) => def.subject !== null && def.phase !== "P9")
  .map(([type, def]) => ({ name: def.label, value: type }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Stop the run when something else happens.
 *
 * The inverse of a trigger. A trigger asks whether a dispatched event should
 * **start** a run; a goal asks whether it should **end** one already in flight.
 * Both read the same event and evaluate their conditions with the same filter
 * engine, so a goal costs one table and one indexed lookup rather than a second
 * matching implementation.
 *
 * This is the node that makes a chase sequence safe to build. "Chase this quote
 * on day 3, day 7 and day 14" is only acceptable if it stops the moment they
 * accept — otherwise the automation keeps nagging a customer who already said
 * yes, which is worse than not having sent anything.
 *
 * ## No outputs, deliberately (D-04)
 *
 * When the goal fires, the run **completes from wherever it had reached**. It
 * does not jump to a branch. The reference implementation gives its goal node a
 * downstream branch that is silently dead; rendering zero handles makes that
 * unexpressible rather than merely discouraged.
 *
 * ## Scope — the decision the design left open
 *
 * A goal has to say *whose* event it is watching for, and the two obvious
 * answers are both wrong on their own:
 *
 *  - **This record.** "Stop chasing when *this invoice* is paid." Scoping by
 *    customer would let any other invoice of theirs end the chase for this one.
 *  - **This customer.** "Stop chasing this quote when they book *anything*."
 *    Scoping by record cannot express it — the booking is a different row than
 *    the quote, so the ids never match.
 *
 * So the author picks. `subject` matches the event's own record; `customer`
 * matches the `customerId` every payload carries. Defaulting to the record is
 * the conservative choice: it ends fewer runs early, and a goal that fails to
 * fire is visible in the run history while one that fires too eagerly looks
 * exactly like success.
 */
export default {
  node: "goal.event",
  version: 1,
  displayName: "Stop when…",
  description: "End this automation early if something else happens first.",
  howItWorks:
    "Put this anywhere below the trigger. From then on, the automation is " +
    "watching — and the moment the thing you pick happens, the run stops where " +
    "it is and is marked complete. Use it so a chase sequence stops the moment " +
    "the customer replies, pays or books, instead of nagging someone who " +
    "already did what you asked.",
  icon: "IconTargetArrow",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  // ZERO. A goal exits the run; anything wired below it would never run, and
  // the validator's `unconnected_branch_output` rule only fires for nodes with
  // more than one output — so a dead branch here would be invisible. Not being
  // able to draw it is the fix.
  outputs: [],

  sideEffect: "none",

  properties: [
    {
      displayName: "Stop when",
      name: "goalEvent",
      type: "options",
      required: true,
      description: "The automation ends as soon as this happens.",
      options: GOAL_EVENT_OPTIONS,
    },
    {
      displayName: "For",
      name: "scope",
      type: "options",
      default: "subject",
      description:
        "Whether it has to be this exact record, or anything belonging to the same customer.",
      options: [
        {
          name: "This record only",
          value: "subject",
          description: "Only the job, invoice or quote this automation is running for.",
        },
        {
          name: "Anything for this customer",
          value: "customer",
          description: "Any record belonging to the same customer counts.",
        },
      ],
    },
    // No extra-conditions field yet, deliberately. A goal filter would have to
    // be evaluated against the **event payload**, while `condition.if` rules
    // hold *variable paths* (`job.status`) resolved from a loaded context —
    // two different vocabularies. Shipping the control before the evaluator
    // would give the author a filter that silently does nothing, which is the
    // exact failure this codebase keeps finding. Event + scope covers "stop
    // when they pay / book / accept", which is the whole reason for the node.
  ],
} satisfies NodeDefinition;
