/**
 * `schedule.daily` and `schedule.weekly`. P9.
 *
 * ## Why this one *does* read node configs, when the others must not
 *
 * Every other sweep is forbidden from reading a node's settings — the sweep
 * raises the event and the declarative filter decides which automations care. A
 * sweep that read configs would be a second implementation of matching.
 *
 * A schedule is the one case where that division does not apply, because there
 * is no record to sweep. Nothing in the database says "9am"; only the trigger
 * does. So the config is not a *filter* here, it is the event's own timing, and
 * reading it is the only way the event can exist at all.
 *
 * The distinction is worth stating because it is exactly the kind of exception
 * that gets copied into a sweep where it does not belong.
 *
 * ## The zone is the automation's, not the tenant's
 *
 * `timezoneMode` on `workflows` exists for this: a tenant may run one automation
 * on their customers' schedule and another on their own. Resolving through the
 * workflow rather than the tenant is the whole reason that column is not just a
 * nullable `timezone`.
 *
 * ## Once, across restarts and instances
 *
 * `workflow_schedule_state` keyed on the workflow, **the trigger step** and the
 * resolved local date. Two instances ticking in the same minute both attempt
 * the insert; exactly one gets a row, and only that one dispatches. No lock, no
 * leader election, no timer that a deploy resets.
 *
 * ## Addressed, not broadcast
 *
 * The event this raises names the step it was raised for, and the matcher
 * delivers it to that step alone (`triggers/index.ts`). It used to be a plain
 * `schedule.daily` for the tenant, which every daily automation in the
 * workspace answered — at the first one's time, because `atTime` is read here
 * and nowhere else — while the outbox's per-tenant dedup key swallowed the rest
 * (ONB-06).
 */

import {
  getDb,
  sql,
  workflowScheduleState,
  workflows,
  workflowVersions,
  and,
  eq,
  isNull,
} from "@hvac-saas/database";
import { z } from "zod";
import type { WorkflowGraph } from "@hvac-saas/types";
import { scheduleDaily, scheduleWeekly } from "../events/producers/schedule.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface ClockResult {
  considered: number;
  fired: number;
  /** Not due yet at this minute, which is almost all of them almost always. */
  notDue: number;
  /** Already fired for this period — the normal case on every later tick. */
  deduped: number;
}

const DAILY_NODE = "trigger.schedule.daily";
const WEEKLY_NODE = "trigger.schedule.weekly";

/**
 * How late a tick may be and still fire.
 *
 * The worker runs every minute, but a slow tick, a restart or a paused process
 * can push it past the configured time. Without a window a 09:00 schedule
 * missed by ninety seconds would simply not run that day, silently — which is
 * the worst kind of failure for something whose entire promise is "every day".
 *
 * Fifteen minutes is late enough to survive a deploy and early enough that
 * nobody reads a 09:14 send as a bug. The dedup row means a catch-up cannot
 * double-send.
 */
const GRACE_MINUTES = 15;

export async function tickSchedules(db: Db = getDb()): Promise<ClockResult> {
  // Active, published automations whose live version declares a schedule
  // trigger. `trigger_types` holds **event names** — the same column the
  // matcher reads, and the same lesson: it was queried with node ids for two
  // days and matched nothing, silently, because both sides were `string[]`.
  const rows = await db
    .select({
      workflowId: workflows.id,
      workflowName: workflows.name,
      tenantId: workflows.tenantId,
      timezoneMode: workflows.timezoneMode,
      workflowTimezone: workflows.timezone,
      versionId: workflowVersions.id,
      graph: workflowVersions.graph,
      triggerTypes: workflowVersions.triggerTypes,
    })
    .from(workflows)
    .innerJoin(
      workflowVersions,
      eq(workflows.activeVersionId, workflowVersions.id),
    )
    .where(and(eq(workflows.isActive, true), isNull(workflows.archivedAt)));

  const scheduled = rows.filter(
    (row) =>
      Array.isArray(row.triggerTypes) &&
      (row.triggerTypes.includes("schedule.daily") ||
        row.triggerTypes.includes("schedule.weekly")),
  );

  let fired = 0;
  let notDue = 0;
  let deduped = 0;

  for (const row of scheduled) {
    const graph = row.graph as WorkflowGraph | null;
    if (!graph?.nodes) continue;

    const clockNodes = graph.nodes.filter(
      (node) => node.nodeType === DAILY_NODE || node.nodeType === WEEKLY_NODE,
    );
    if (clockNodes.length === 0) continue;

    // Once per automation, not once per step: every step on one canvas shares
    // the automation's zone, and asking Postgres the time twice in one tick can
    // straddle a minute boundary and give two steps two different "now"s.
    const zone = await resolveZone(db, row);
    const local = await localNow(db, zone);

    for (const node of clockNodes) {
      const parameters = node.nodeConfig?.parameters ?? {};

      const atTime =
        typeof parameters.atTime === "string" ? parameters.atTime : "09:00";

      if (!isDue(local, atTime)) {
        notDue += 1;
        continue;
      }

      if (node.nodeType === WEEKLY_NODE) {
        const weekday =
          typeof parameters.weekday === "string" ? Number(parameters.weekday) : 1;
        if (local.isoWeekday !== weekday) {
          notDue += 1;
          continue;
        }
      }

      // Keyed on the STEP, not the automation. Per automation, a canvas with a
      // Monday step and a Friday step fired on Monday and then found Friday's
      // claim already taken for the week; two daily steps at 08:00 and 17:00
      // lost the afternoon one the same way.
      const dedupKey =
        node.nodeType === WEEKLY_NODE
          ? `schedule.weekly:${row.workflowId}:${node.id}:${local.isoWeek}`
          : `schedule.daily:${row.workflowId}:${node.id}:${local.date}`;

      // The claim and the emit commit together. Apart, an emit that failed after
      // its claim had committed would leave the period marked as fired with
      // nothing in the outbox — and every later tick in the grace window would
      // read the claim as "already done", so that day's run is lost silently.
      const didFire = await db.transaction(async (tx) => {
        const claimed = await tx
          .insert(workflowScheduleState)
          .values({
            tenantId: row.tenantId,
            workflowId: row.workflowId,
            dedupKey,
            kind: node.nodeType === WEEKLY_NODE ? "schedule-weekly" : "schedule-daily",
          })
          .onConflictDoNothing()
          .returning({ id: workflowScheduleState.id });

        if (claimed.length === 0) return false;

        const target = {
          tenantId: row.tenantId,
          actorUserId: null,
          workflowId: row.workflowId,
          triggerNodeId: node.id,
          localDate: local.date,
          timezone: zone,
        };
        if (node.nodeType === WEEKLY_NODE) {
          await scheduleWeekly(tx, { ...target, isoWeek: local.isoWeek });
        } else {
          await scheduleDaily(tx, target);
        }
        return true;
      });

      if (!didFire) {
        deduped += 1;
        continue;
      }
      fired += 1;
    }
  }

  return { considered: scheduled.length, fired, notDue, deduped };
}

/** The automation's own zone when it has one, else the tenant's. */
async function resolveZone(
  db: Db,
  row: { tenantId: string; timezoneMode: string | null; workflowTimezone: string | null },
): Promise<string> {
  if (row.timezoneMode === "custom" && row.workflowTimezone) {
    return row.workflowTimezone;
  }
  const result = await db.execute(sql`
    SELECT timezone FROM tenants WHERE id = ${row.tenantId}
  `);
  const rows = Array.isArray(result) ? result : [];
  const zone = (rows[0] as { timezone?: string } | undefined)?.timezone;
  // The same fallback the rest of the system uses. A datetime that silently
  // becomes the server's zone is the most damaging class of automation bug
  // there is — a reminder in the wrong timezone is a missed appointment.
  return zone || "America/Chicago";
}

const localRow = z.object({
  local_date: z.string(),
  local_minutes: z.coerce.number().int(),
  iso_weekday: z.coerce.number().int(),
  iso_week: z.string(),
});

/**
 * "What time is it there" — asked of Postgres, not of Node.
 *
 * Node's `Intl` could do this, and the reason not to is consistency: every other
 * date decision in this feature is `(now() AT TIME ZONE t.timezone)::date`, and
 * two implementations of "which local day is it" disagreeing by an hour twice a
 * year is precisely the DST class of bug the P6 gate spent a day proving absent.
 */
async function localNow(db: Db, zone: string) {
  const result = await db.execute(sql`
    SELECT
      (now() AT TIME ZONE ${zone})::date                        AS local_date,
      EXTRACT(hour FROM now() AT TIME ZONE ${zone}) * 60
        + EXTRACT(minute FROM now() AT TIME ZONE ${zone})       AS local_minutes,
      EXTRACT(isodow FROM now() AT TIME ZONE ${zone})           AS iso_weekday,
      to_char(now() AT TIME ZONE ${zone}, 'IYYY-"W"IW')         AS iso_week
  `);
  const rows = Array.isArray(result) ? result : [];
  const parsed = localRow.parse(rows[0]);
  return {
    date: parsed.local_date,
    minutes: parsed.local_minutes,
    isoWeekday: parsed.iso_weekday,
    isoWeek: parsed.iso_week,
  };
}

/**
 * Is it at or just past the configured time?
 *
 * A window, not an equality. An equality check against a once-a-minute tick
 * misses the day the tick is a second late, and "silently skipped one day" is
 * unfixable after the fact.
 */
function isDue(local: { minutes: number }, atTime: string): boolean {
  const [hh, mm] = atTime.split(":");
  const target = Number(hh) * 60 + Number(mm ?? 0);
  if (!Number.isFinite(target)) return false;
  const delta = local.minutes - target;
  return delta >= 0 && delta <= GRACE_MINUTES;
}
