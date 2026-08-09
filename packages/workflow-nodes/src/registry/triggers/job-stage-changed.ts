import type { NodeDefinition } from "../../node-definition.js";

/**
 * A job moved between pipeline stages — the trigger a CRM exists to have.
 *
 * Everything else here fires on a domain event that happens *to* a record. This
 * one fires on the thing the contractor does all day: dragging a card. "When a
 * job reaches In Progress, tell the customer we are on our way" is the shape
 * most automation requests actually take, and until now the only stage-related
 * trigger was `job.completed` — one stage, one direction.
 *
 * **Filter on the lifecycle, not the stage name or id.** A tenant can rename
 * "Completed" to "Done and dusted", add a stage, or reorder the board, and a
 * filter keyed to any of those breaks silently — the automation simply stops
 * matching, with nothing to see. `toLifecycle` maps every stage to one of four
 * fixed states, so it survives the tenant editing their own pipeline. That is
 * the same reasoning `jobs.stage_id` + `lifecycle` was introduced under
 * (JOB-01), and the event's own registry entry says so too.
 */
export default {
  node: "trigger.job.stageChanged",
  version: 1,
  displayName: "Job Moves Stage",
  description: "Runs when a job moves to a different stage on the board.",
  howItWorks:
    "Fires on the move itself, however it happened — dragging the card, the " +
    "detail page, or a bulk action. Filter by what the new stage *means* rather " +
    "than what it is called, so renaming a column on your board never quietly " +
    "stops this running.",
  icon: "IconArrowRight",
  category: "trigger",
  subcategory: "trigger.job",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["job.stage_changed"],
  requiresSubject: ["job"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only when the job moves to",
      name: "toLifecycle",
      type: "multiOptions",
      description: "Leave all off to run on every move.",
      options: [
        { name: "Scheduled", value: "scheduled" },
        { name: "In progress", value: "in_progress" },
        { name: "Completed", value: "completed" },
        { name: "Cancelled", value: "cancelled" },
      ],
      // `inList`, so choosing two stages means either — which is what selecting
      // two things in a multi-select reads as. An empty array is `isUnset`, so
      // an untouched control runs on everything.
      filter: { path: "toLifecycle", operator: "inList" },
    },
    {
      // Values are real booleans, matched against `payload.bulk` with `equals`.
      // `"__any__"` is `isUnset`'s sentinel, so the default applies no filter at
      // all — the automation runs when the thing happens, and opting out is a
      // choice. The event carries `bulk` precisely so this can be offered.
      displayName: "Bulk moves",
      name: "bulk",
      type: "options",
      default: "__any__",
      description:
        "Moving fifty jobs at once fires this fifty times. Worth turning off if this step emails somebody.",
      options: [
        { name: "Run for these too", value: "__any__" },
        { name: "Only jobs moved one at a time", value: false },
        { name: "Only bulk moves", value: true },
      ],
      filter: { path: "bulk", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;
