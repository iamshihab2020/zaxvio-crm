/**
 * What a pipeline stage *means*, as opposed to what it is called.
 *
 * A tenant can name a stage anything — "Done", "Wrapped up", "Invoiced" — so
 * the name cannot be what the product reasons about. `lifecycle` is the four
 * fixed states behind every custom stage: it decides when the completion email
 * goes out, when `completedAt` is stamped, which moves are legal, and what the
 * reports count as finished work.
 *
 * Mirrors `job_status` in the database (`job_pipeline_stages.lifecycle`).
 */

export const STAGE_LIFECYCLES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type StageLifecycle = (typeof STAGE_LIFECYCLES)[number];

/**
 * Written for the person configuring the pipeline, not for the schema.
 *
 * The Manage Pipeline dialog only ever *offers* `completed` and `cancelled`:
 * those are the two a stage has to declare, because they change what happens to
 * a job rather than just where it sits. Everything else is open work, which is
 * why an unmarked stage is stored as `scheduled` and why any number of stages
 * may share that value — moving between same-lifecycle stages is always legal.
 */
export const STAGE_LIFECYCLE_META: Record<
  StageLifecycle,
  { label: string; description: string }
> = {
  scheduled: {
    label: "Not started",
    description: "Work is booked but nobody is on site yet.",
  },
  in_progress: {
    label: "In progress",
    description: "Work has started and is not finished.",
  },
  completed: {
    label: "Completed",
    description:
      "The job is finished: it stamps a completion date, sends the completion email, and counts as finished work in reports.",
  },
  cancelled: {
    label: "Cancelled",
    description: "The job will not happen. It is excluded from active counts.",
  },
};

export function stageLifecycleLabel(lifecycle: string): string {
  return (
    STAGE_LIFECYCLE_META[lifecycle as StageLifecycle]?.label ?? "Not started"
  );
}
