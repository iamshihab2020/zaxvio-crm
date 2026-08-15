import { SERVICE_TYPES, enumOptions } from "../../crm-enums.js";
import type { NodeDefinition } from "../../node-definition.js";

/**
 * Fires off `job.completed`, which is emitted from `services/jobs/stage-events`
 * — one implementation shared by `PATCH /jobs/:id/status` and the bulk path.
 * That sharing is why this trigger is trustworthy: JOB-22 found the bulk path
 * skipping the completion email the single path sent, and a trigger wired to
 * only one of them would have had the same hole.
 *
 * The filters below are **declarations, not code**. One generic evaluator reads
 * `filter: { path, operator }` for every trigger in the catalogue, so adding a
 * filter here does not mean writing a matcher — the system this was ported from
 * hand-codes them across 3,146 lines, and a missing branch means a filter the
 * user configured does nothing at all.
 */
export default {
  node: "trigger.job.completed",
  version: 1,
  displayName: "Job Completed",
  description: "Runs when a job is moved into a completed stage.",
  howItWorks:
    "Fires the moment a job reaches a stage marked Completed — whether that was " +
    "a drag on the board, the detail sheet, or a bulk action. Moving between two " +
    "completed stages does not fire it again.",
  icon: "IconCircleCheck",
  category: "trigger",
  subcategory: "trigger.job",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["job.completed"],
  requiresSubject: ["job"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only these service types",
      name: "serviceType",
      type: "multiOptions",
      description: "Leave empty to run for every service type.",
      filter: { path: "serviceType", operator: "inList" },
      // From `SERVICE_TYPES`, not written out. Three definitions each had their
      // own copy of this list, and a filter whose options miss the payload's
      // enum matches nothing — silently — which is the one failure the
      // declarative design exists to prevent.
      options: enumOptions(SERVICE_TYPES),
    },
    {
      displayName: "Only jobs on this pipeline",
      name: "pipelineId",
      type: "pipelineSelect",
      description: "Leave empty for every pipeline.",
      // Checked when the graph is saved AND when the node runs — a pipeline can
      // be deleted, and an automation can be duplicated into another workspace.
      ownership: "pipeline",
      filter: { path: "pipelineId", operator: "equals" },
    },
    {
      displayName: "Only jobs worth at least",
      name: "minTotal",
      type: "moneyInput",
      description:
        "Leave empty for any amount. Entered and compared in whole cents, so nothing is lost to rounding.",
      filter: { path: "totalAmount", operator: "greaterThanOrEqual" },
    },
  ],
} satisfies NodeDefinition;
