import type { NodeDefinition } from "../../node-definition.js";

/**
 * Move a job to a pipeline stage.
 *
 * The first node that *changes* the CRM rather than telling someone about it,
 * and the reason the stage picker exists.
 *
 * It resolves through `job-stages.service.ts` — the one place that decides what
 * stage a job may move to and what `jobs.status` becomes as a result. Writing
 * the columns here would reintroduce QUO-02 exactly: `lib/quote-to-job.ts` set
 * `jobs.status` by hand and never `stage_id`, so for four days every job created
 * from a quote sat outside the stage model, counted 0 in the pipeline counts and
 * matched no lifecycle filter.
 *
 * `pipelineId` is required even though a stage id alone would identify the
 * stage: the picker needs it to filter, and `resolveStage` uses it to refuse a
 * stage belonging to a different pipeline.
 */
export default {
  node: "job.moveStage",
  version: 1,
  displayName: "Move Job Stage",
  description: "Move the job to a different column on your board.",
  howItWorks:
    "Moves the job the automation is running on. The same rules apply as dragging " +
    "the card yourself, so a move your board would refuse is refused here too — " +
    "and the run says which move it was.",
  icon: "IconArrowRight",
  category: "crm",
  subcategory: "crm.job",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["job"],
  mutates: ["job"],
  // Running it twice leaves the job in the same stage, so a resume after a
  // crash can safely re-enter it.
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Pipeline",
      name: "pipelineId",
      type: "pipelineSelect",
      required: true,
      description: "Which board the stage belongs to.",
      ownership: "pipeline",
    },
    {
      displayName: "Move to",
      name: "stageId",
      type: "stageSelect",
      required: true,
      description: "The column to move the job into.",
      typeOptions: { dependsOn: "pipelineId" },
      ownership: "stage",
      // No `displayOptions` here. `show` matches against listed VALUES, so
      // `{ pipelineId: [] }` means "show when the value is one of none" — the
      // field would be hidden forever. The stage picker already disables itself
      // and says "Pick a pipeline first", which is better than hiding it: the
      // user can see what is coming rather than watching a field appear.
    },
  ],
} satisfies NodeDefinition;
