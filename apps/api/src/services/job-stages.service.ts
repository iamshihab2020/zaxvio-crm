/**
 * Job pipeline stage resolution — the one place that decides what stage a job
 * is allowed to move to, and what `jobs.status` becomes as a result.
 *
 * Background (report §5.1, JOB-01/02/03/06/28). `jobs.status` was a plain
 * `text` column that doubled as two different things: the four-value lifecycle
 * the product reasons about (transitions, `completedAt`, reporting) *and* the
 * name of the Kanban column a job sits in. Tenants can create stages with any
 * name — `POST /pipeline-stages` writes `name = slugify(label)` — but every
 * status-writing Zod schema hardcoded the four canonical values, so a job could
 * never actually be moved into a custom stage. The column rendered; the drop
 * 400'd at validation before the handler ever ran.
 *
 * The split: `job_pipeline_stages.lifecycle` says which of the four real
 * statuses a stage represents, `jobs.stage_id` is the pointer, and `jobs.status`
 * stays as the stage's `name` — denormalised for the many queries that filter
 * on it, but only ever written from a stage resolved through here.
 */

import {
  getDb,
  jobPipelineStages,
  pipelines,
  and,
  eq,
  asc,
  inArray,
} from "@hvac-saas/database";

export type JobLifecycle =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export const JOB_LIFECYCLES: readonly JobLifecycle[] = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export interface ResolvedStage {
  id: string;
  pipelineId: string;
  name: string;
  label: string;
  lifecycle: JobLifecycle;
  sortOrder: number;
}

type Db = ReturnType<typeof getDb>;

/**
 * Allowed *lifecycle* transitions. Keyed on lifecycle, never on a stage name —
 * that was the old bug: `VALID_TRANSITIONS["scheduled"]` does not contain
 * `"scheduled"`, so dragging a card within its own column looked like an
 * illegal transition and the write was skipped entirely.
 */
const LIFECYCLE_TRANSITIONS: Record<JobLifecycle, JobLifecycle[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [], // terminal
  cancelled: ["scheduled"], // allow re-scheduling
};

/**
 * A move is legal when the lifecycle does not change (any number of custom
 * stages may share one lifecycle — moving between them is just workflow) or
 * when the lifecycle change itself is allowed.
 */
export function canTransition(from: JobLifecycle, to: JobLifecycle): boolean {
  if (from === to) return true;
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionMessage(
  from: ResolvedStage | { label: string; lifecycle: JobLifecycle },
  to: ResolvedStage | { label: string; lifecycle: JobLifecycle },
): string {
  return `Cannot move a ${from.lifecycle.replace("_", " ")} job to "${to.label}" (${to.lifecycle.replace("_", " ")})`;
}

const STAGE_COLUMNS = {
  id: jobPipelineStages.id,
  pipelineId: jobPipelineStages.pipelineId,
  name: jobPipelineStages.name,
  label: jobPipelineStages.label,
  lifecycle: jobPipelineStages.lifecycle,
  sortOrder: jobPipelineStages.sortOrder,
};

/**
 * Resolve the stage a request is asking for. Accepts either a `stageId` (the
 * precise form) or a `status` string, which is matched against `name` and then
 * against `lifecycle` so existing clients that send "in_progress" keep working
 * even when the tenant has renamed their columns.
 *
 * Always tenant-scoped — a stage id from another tenant resolves to null rather
 * than moving the job somewhere it cannot see.
 */
export async function resolveStage(
  db: Db,
  params: {
    tenantId: string;
    pipelineId: string | null;
    stageId?: string | null;
    status?: string | null;
  },
): Promise<ResolvedStage | null> {
  const { tenantId, pipelineId, stageId, status } = params;

  if (stageId) {
    const [stage] = await db
      .select(STAGE_COLUMNS)
      .from(jobPipelineStages)
      .where(
        and(
          eq(jobPipelineStages.tenantId, tenantId),
          eq(jobPipelineStages.id, stageId),
        ),
      );
    if (!stage) return null;
    // A stage id that belongs to a different pipeline than the job is a
    // client bug, not a move — reject rather than silently re-piping the job.
    if (pipelineId && stage.pipelineId !== pipelineId) return null;
    return stage as ResolvedStage;
  }

  if (!status || !pipelineId) return null;

  const [byName] = await db
    .select(STAGE_COLUMNS)
    .from(jobPipelineStages)
    .where(
      and(
        eq(jobPipelineStages.tenantId, tenantId),
        eq(jobPipelineStages.pipelineId, pipelineId),
        eq(jobPipelineStages.name, status),
      ),
    );
  if (byName) return byName as ResolvedStage;

  // Fall back to lifecycle so a client sending a canonical status still lands
  // somewhere sensible in a pipeline whose columns have been renamed.
  if (!isLifecycle(status)) return null;
  const [byLifecycle] = await db
    .select(STAGE_COLUMNS)
    .from(jobPipelineStages)
    .where(
      and(
        eq(jobPipelineStages.tenantId, tenantId),
        eq(jobPipelineStages.pipelineId, pipelineId),
        eq(jobPipelineStages.lifecycle, status),
      ),
    )
    .orderBy(asc(jobPipelineStages.sortOrder))
    .limit(1);

  return (byLifecycle as ResolvedStage | undefined) ?? null;
}

export function isLifecycle(value: string): value is JobLifecycle {
  return (JOB_LIFECYCLES as readonly string[]).includes(value);
}

/** The entry stage of a pipeline — lowest sort order. Where new jobs start. */
export async function getFirstStage(
  db: Db,
  params: { tenantId: string; pipelineId: string },
): Promise<ResolvedStage | null> {
  const [stage] = await db
    .select(STAGE_COLUMNS)
    .from(jobPipelineStages)
    .where(
      and(
        eq(jobPipelineStages.tenantId, params.tenantId),
        eq(jobPipelineStages.pipelineId, params.pipelineId),
      ),
    )
    .orderBy(asc(jobPipelineStages.sortOrder))
    .limit(1);
  return (stage as ResolvedStage | undefined) ?? null;
}

/**
 * All stages for a set of pipelines, grouped by pipeline id. Used by the bulk
 * and reorder paths so N jobs across M pipelines cost one query, not N.
 */
export async function loadStagesByPipeline(
  db: Db,
  tenantId: string,
  pipelineIds: string[],
): Promise<Map<string, ResolvedStage[]>> {
  const grouped = new Map<string, ResolvedStage[]>();
  const unique = [...new Set(pipelineIds.filter(Boolean))];
  if (unique.length === 0) return grouped;

  const rows = await db
    .select(STAGE_COLUMNS)
    .from(jobPipelineStages)
    .where(
      and(
        eq(jobPipelineStages.tenantId, tenantId),
        inArray(jobPipelineStages.pipelineId, unique),
      ),
    )
    .orderBy(asc(jobPipelineStages.sortOrder));

  for (const row of rows as ResolvedStage[]) {
    const list = grouped.get(row.pipelineId);
    if (list) list.push(row);
    else grouped.set(row.pipelineId, [row]);
  }
  return grouped;
}

/**
 * Pick a stage out of an already-loaded pipeline list. Same matching order as
 * {@link resolveStage} — id, then name, then lifecycle — but without a query.
 */
export function matchStage(
  stages: ResolvedStage[] | undefined,
  target: { stageId?: string | null; status?: string | null },
): ResolvedStage | null {
  if (!stages || stages.length === 0) return null;
  if (target.stageId) {
    return stages.find((s) => s.id === target.stageId) ?? null;
  }
  if (!target.status) return null;
  const byName = stages.find((s) => s.name === target.status);
  if (byName) return byName;
  if (!isLifecycle(target.status)) return null;
  return stages.find((s) => s.lifecycle === target.status) ?? null;
}

/**
 * The column writes a stage move implies. `status` mirrors the stage name;
 * `completedAt` is set when the job enters a completed lifecycle and cleared
 * when it leaves one, so a re-opened job does not keep a stale completion date.
 */
export function stageUpdate(
  stage: ResolvedStage,
  previousLifecycle: JobLifecycle | null,
): { stageId: string; status: string; completedAt?: Date | null } {
  const update: {
    stageId: string;
    status: string;
    completedAt?: Date | null;
  } = {
    stageId: stage.id,
    status: stage.name,
  };
  if (stage.lifecycle === "completed" && previousLifecycle !== "completed") {
    update.completedAt = new Date();
  } else if (
    stage.lifecycle !== "completed" &&
    previousLifecycle === "completed"
  ) {
    update.completedAt = null;
  }
  return update;
}

/**
 * The lifecycle a job is currently in. Reads the stage when the job has one and
 * falls back to interpreting `jobs.status` for rows written before the split.
 */
export async function getJobLifecycle(
  db: Db,
  params: { tenantId: string; stageId: string | null; status: string },
): Promise<JobLifecycle> {
  if (params.stageId) {
    const [stage] = await db
      .select({ lifecycle: jobPipelineStages.lifecycle })
      .from(jobPipelineStages)
      .where(
        and(
          eq(jobPipelineStages.tenantId, params.tenantId),
          eq(jobPipelineStages.id, params.stageId),
        ),
      );
    if (stage) return stage.lifecycle as JobLifecycle;
  }
  return isLifecycle(params.status) ? params.status : "scheduled";
}

/** Resolve a tenant's default pipeline id, or null when none is marked. */
export async function getDefaultPipelineId(
  db: Db,
  tenantIdValue: string,
): Promise<string | null> {
  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(
      and(eq(pipelines.tenantId, tenantIdValue), eq(pipelines.isDefault, true)),
    );
  return pipeline?.id ?? null;
}
