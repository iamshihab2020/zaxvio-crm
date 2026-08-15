/**
 * The clock. P9.
 *
 * Four kinds of event have no write behind them — nothing *happens* to make a
 * warranty expire — so they need something that looks at the calendar. The
 * `invoice.overdue` sweep was the first; this is the rest, and it is one worker
 * rather than four because they share the hard part.
 *
 * ## The hard part is "once"
 *
 * Every sweep here must fire once per thing per period, and must keep meaning
 * that across a restart, two API instances, and a tick that overlaps the
 * previous one. There are two mechanisms in this codebase for that and they are
 * not interchangeable:
 *
 * - **`emit({dedupKey})`** — the outbox's unique index. Right for
 *   `invoice.overdue`, which repeats *daily* and only needs the memory to last
 *   until tomorrow.
 * - **`workflow_schedule_state`** — a permanent row. Right for everything here,
 *   because "we already told them about this warranty" has to still be true in
 *   ninety days, and the retention sweep clears the queue at thirty. Dedup that
 *   silently expires is worse than none: it fires again, once, months later, and
 *   looks like a one-off glitch.
 *
 * ## Dates are calendar dates, in the tenant's zone
 *
 * `(now() AT TIME ZONE t.timezone)::date` throughout, and the resolved date goes
 * **into the dedup key** rather than being compared against `fired_at`. Deciding
 * "which day is it" from a UTC instant gives a different answer per tenant, and
 * the decision belongs to the query that already knows the zone. On Neon the
 * server is UTC, so without this a Chicago tenant's "daily 9am" would fire at
 * 3am local.
 */

import { getDb, sql, workflowScheduleState } from "@hvac-saas/database";
import { z } from "zod";
import { SERVICE_FREQUENCIES } from "@hvac-saas/workflow-nodes";
import {
  contractExpiring,
  contractVisitDue,
  equipmentWarrantyExpiring,
} from "../events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Rows per kind per tick.
 *
 * A bound, not a promise there will never be more. What is dropped is returned
 * and logged — a silent cap reads as "we covered everything", which is the
 * failure this project has now found in the retention sweep, the report row cap
 * and the bulk bar.
 */
const BATCH_LIMIT = 500;

export interface ScheduleSweepResult {
  kind: string;
  scanned: number;
  emitted: number;
  /** Already done — the normal case on every tick after the first. */
  deduped: number;
  truncated: boolean;
}

/**
 * Claim a key, or discover somebody already has it.
 *
 * `onConflictDoNothing` returning no row **is** the answer, not an error. Two
 * instances sweeping at the same second both attempt the insert; exactly one
 * gets a row and exactly one event is raised, with no lock and no coordination.
 *
 * Returns `true` when this caller won and should emit.
 */
async function claim(
  db: Db,
  args: { tenantId: string; workflowId?: string | null; dedupKey: string; kind: string },
): Promise<boolean> {
  const rows = await db
    .insert(workflowScheduleState)
    .values({
      tenantId: args.tenantId,
      workflowId: args.workflowId ?? null,
      dedupKey: args.dedupKey,
      kind: args.kind,
    })
    .onConflictDoNothing()
    .returning({ id: workflowScheduleState.id });
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warranties
// ─────────────────────────────────────────────────────────────────────────────

const warrantyRow = z.object({
  equipment_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  equipment_type: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  location: z.string().nullable(),
  install_date: z.string().nullable(),
  warranty_expiry: z.string(),
  customer_id: z.string().uuid(),
  customer_first_name: z.string(),
  customer_last_name: z.string(),
  customer_email: z.string().nullable(),
  customer_phone: z.string().nullable(),
  days_until_expiry: z.coerce.number().int(),
});

/**
 * Warranties inside the widest lead time any active automation asks for.
 *
 * The query uses a **fixed 365-day window** rather than reading each
 * automation's `leadDays`, and the node's filter narrows it afterwards. That is
 * the same division the whole trigger design rests on: the sweep raises the
 * event, the declarative filter decides whether a given automation cares. A
 * sweep that read node configs would be a second implementation of matching.
 */
export async function sweepWarrantiesExpiring(
  db: Db = getDb(),
): Promise<ScheduleSweepResult> {
  const raw = await db.execute(sql`
    SELECT
      e.id              AS equipment_id,
      e.tenant_id       AS tenant_id,
      e.equipment_type  AS equipment_type,
      e.brand           AS brand,
      e.model           AS model,
      e.serial_number   AS serial_number,
      e.location        AS location,
      e.install_date    AS install_date,
      e.warranty_expiry AS warranty_expiry,
      c.id              AS customer_id,
      c.first_name      AS customer_first_name,
      c.last_name       AS customer_last_name,
      c.email           AS customer_email,
      c.phone           AS customer_phone,
      (e.warranty_expiry - (now() AT TIME ZONE t.timezone)::date) AS days_until_expiry
    FROM equipment e
    JOIN tenants t   ON t.id = e.tenant_id
    JOIN customers c ON c.id = e.customer_id AND c.tenant_id = e.tenant_id
    WHERE e.archived_at IS NULL
      AND e.warranty_expiry IS NOT NULL
      -- Not yet expired, and within a year. The upper bound keeps the scan
      -- bounded; the lower bound is what makes this "expiring" rather than
      -- "expired", which is a different message and would be a different node.
      AND e.warranty_expiry >= (now() AT TIME ZONE t.timezone)::date
      AND e.warranty_expiry <= (now() AT TIME ZONE t.timezone)::date + 365
    ORDER BY e.warranty_expiry ASC
    LIMIT ${BATCH_LIMIT + 1}
  `);

  const rows = Array.isArray(raw) ? raw : [];
  const truncated = rows.length > BATCH_LIMIT;
  const batch = rows.slice(0, BATCH_LIMIT);

  let emitted = 0;
  let deduped = 0;

  for (const row of batch) {
    const parsed = warrantyRow.parse(row);

    // Keyed on the equipment id **and its expiry date**. The id alone would make
    // a warranty whose date is later corrected permanently un-chaseable — the
    // row says "done" and there is no way to tell it the date moved.
    const won = await claim(db, {
      tenantId: parsed.tenant_id,
      dedupKey: `warranty:${parsed.equipment_id}:${parsed.warranty_expiry}`,
      kind: "warranty",
    });

    if (!won) {
      deduped += 1;
      continue;
    }

    await equipmentWarrantyExpiring(db, {
      tenantId: parsed.tenant_id,
      actorUserId: null,
      equipment: {
        equipmentId: parsed.equipment_id,
        equipmentType: parsed.equipment_type,
        brand: parsed.brand,
        model: parsed.model,
        serialNumber: parsed.serial_number,
        location: parsed.location,
        installDate: parsed.install_date,
        warrantyExpiry: parsed.warranty_expiry,
        customerId: parsed.customer_id,
        customerFirstName: parsed.customer_first_name,
        customerLastName: parsed.customer_last_name,
        customerEmail: parsed.customer_email,
        customerPhone: parsed.customer_phone,
      },
      daysUntilExpiry: parsed.days_until_expiry,
    });
    emitted += 1;
  }

  return { kind: "warranty", scanned: batch.length, emitted, deduped, truncated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service agreements
// ─────────────────────────────────────────────────────────────────────────────

const contractRow = z.object({
  contract_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contract_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  // The real enum, not `z.string()`. api-rules §4 says a raw SQL result is
  // Zod-validated at the query function, and validating it *as the enum* is
  // what catches drift here — the payload schema downstream declares the same
  // closed set, and a bare string reaching it drops the event silently.
  frequency: z.enum(SERVICE_FREQUENCIES).nullable(),
  visits_per_year: z.coerce.number().int().nullable(),
  annual_price: z.string().nullable(),
  customer_id: z.string().uuid(),
  customer_first_name: z.string(),
  customer_last_name: z.string(),
  customer_email: z.string().nullable(),
  customer_phone: z.string().nullable(),
  days_until_end: z.coerce.number().int(),
});

export async function sweepContractsExpiring(
  db: Db = getDb(),
): Promise<ScheduleSweepResult> {
  const raw = await db.execute(sql`
    SELECT
      m.id             AS contract_id,
      m.tenant_id      AS tenant_id,
      m.contract_name  AS contract_name,
      m.start_date     AS start_date,
      m.end_date       AS end_date,
      m.frequency::text AS frequency,
      m.visits_per_year AS visits_per_year,
      m.annual_price   AS annual_price,
      c.id             AS customer_id,
      c.first_name     AS customer_first_name,
      c.last_name      AS customer_last_name,
      c.email          AS customer_email,
      c.phone          AS customer_phone,
      (m.end_date - (now() AT TIME ZONE t.timezone)::date) AS days_until_end
    FROM maintenance_contracts m
    JOIN tenants t   ON t.id = m.tenant_id
    JOIN customers c ON c.id = m.customer_id AND c.tenant_id = m.tenant_id
    WHERE m.is_active = true
      AND m.end_date >= (now() AT TIME ZONE t.timezone)::date
      AND m.end_date <= (now() AT TIME ZONE t.timezone)::date + 365
    ORDER BY m.end_date ASC
    LIMIT ${BATCH_LIMIT + 1}
  `);

  const rows = Array.isArray(raw) ? raw : [];
  const truncated = rows.length > BATCH_LIMIT;
  const batch = rows.slice(0, BATCH_LIMIT);

  let emitted = 0;
  let deduped = 0;

  for (const row of batch) {
    const parsed = contractRow.parse(row);

    // The end date is in the key, so extending an agreement for another year
    // makes it chaseable again next year. Keyed on the id alone, a renewed
    // contract would never be chased a second time.
    const won = await claim(db, {
      tenantId: parsed.tenant_id,
      dedupKey: `contract-expiring:${parsed.contract_id}:${parsed.end_date}`,
      kind: "contract-expiring",
    });

    if (!won) {
      deduped += 1;
      continue;
    }

    await contractExpiring(db, {
      tenantId: parsed.tenant_id,
      actorUserId: null,
      contract: contractPayload(parsed),
      daysUntilEnd: parsed.days_until_end,
    });
    emitted += 1;
  }

  return {
    kind: "contract-expiring",
    scanned: batch.length,
    emitted,
    deduped,
    truncated,
  };
}

/**
 * The next maintenance visit under each agreement.
 *
 * ## The date is derived, not stored
 *
 * There is no `next_visit_date` column, and adding one would be a second
 * declaration of something the agreement already says: `start_date`,
 * `visits_per_year` and today are enough. A stored column would drift the first
 * time somebody edited the frequency.
 *
 * The arithmetic is deliberately in SQL rather than TypeScript — `generate_series`
 * over an interval is exactly the PostgreSQL-specific case [[api-rules|§3]] says
 * to reach for raw SQL for, and expressing "every N months from the start date,
 * find the next one" in Drizzle would be fighting the ORM for no gain.
 */
const visitRow = contractRow.extend({
  next_visit_date: z.string(),
  days_until_visit: z.coerce.number().int(),
});

export async function sweepContractVisitsDue(
  db: Db = getDb(),
): Promise<ScheduleSweepResult> {
  const raw = await db.execute(sql`
    WITH visits AS (
      SELECT
        m.id AS contract_id,
        -- Every scheduled visit from the start date to the end date, spaced by
        -- the agreement's own frequency. visits_per_year may be null on old
        -- rows, so it falls back to 2, which is what the column defaults to.
        -- (No backticks anywhere in this template. Inside a tagged SQL template
        -- a backtick ends the string, whatever it looks like it is quoting.
        -- That cost a whole day on 2026-08-09, and the reported error points at
        -- the first word after the break rather than at the cause. This comment
        -- had them too, on its first draft.)
        generate_series(
          m.start_date::timestamp,
          m.end_date::timestamp,
          (interval '12 months' / GREATEST(COALESCE(m.visits_per_year, 2), 1))
        )::date AS visit_date
      FROM maintenance_contracts m
      WHERE m.is_active = true
    ),
    next_visit AS (
      SELECT DISTINCT ON (v.contract_id)
        v.contract_id,
        v.visit_date
      FROM visits v
      JOIN maintenance_contracts m ON m.id = v.contract_id
      JOIN tenants t ON t.id = m.tenant_id
      WHERE v.visit_date >= (now() AT TIME ZONE t.timezone)::date
      ORDER BY v.contract_id, v.visit_date ASC
    )
    SELECT
      m.id             AS contract_id,
      m.tenant_id      AS tenant_id,
      m.contract_name  AS contract_name,
      m.start_date     AS start_date,
      m.end_date       AS end_date,
      m.frequency::text AS frequency,
      m.visits_per_year AS visits_per_year,
      m.annual_price   AS annual_price,
      c.id             AS customer_id,
      c.first_name     AS customer_first_name,
      c.last_name      AS customer_last_name,
      c.email          AS customer_email,
      c.phone          AS customer_phone,
      (m.end_date - (now() AT TIME ZONE t.timezone)::date) AS days_until_end,
      n.visit_date     AS next_visit_date,
      (n.visit_date - (now() AT TIME ZONE t.timezone)::date) AS days_until_visit
    FROM next_visit n
    JOIN maintenance_contracts m ON m.id = n.contract_id
    JOIN tenants t   ON t.id = m.tenant_id
    JOIN customers c ON c.id = m.customer_id AND c.tenant_id = m.tenant_id
    -- Inside the widest lead time any node offers. The node's own filter
    -- narrows it; the sweep only has to raise the event.
    WHERE n.visit_date <= (now() AT TIME ZONE t.timezone)::date + 120
    ORDER BY n.visit_date ASC
    LIMIT ${BATCH_LIMIT + 1}
  `);

  const rows = Array.isArray(raw) ? raw : [];
  const truncated = rows.length > BATCH_LIMIT;
  const batch = rows.slice(0, BATCH_LIMIT);

  let emitted = 0;
  let deduped = 0;

  for (const row of batch) {
    const parsed = visitRow.parse(row);

    const won = await claim(db, {
      tenantId: parsed.tenant_id,
      dedupKey: `contract-visit:${parsed.contract_id}:${parsed.next_visit_date}`,
      kind: "contract-visit",
    });

    if (!won) {
      deduped += 1;
      continue;
    }

    await contractVisitDue(db, {
      tenantId: parsed.tenant_id,
      actorUserId: null,
      contract: contractPayload(parsed),
      visitDate: parsed.next_visit_date,
      daysUntilVisit: parsed.days_until_visit,
    });
    emitted += 1;
  }

  return {
    kind: "contract-visit",
    scanned: batch.length,
    emitted,
    deduped,
    truncated,
  };
}

function contractPayload(row: z.infer<typeof contractRow>) {
  return {
    contractId: row.contract_id,
    contractName: row.contract_name,
    startDate: row.start_date,
    endDate: row.end_date,
    frequency: row.frequency,
    visitsPerYear: row.visits_per_year,
    annualPrice: row.annual_price,
    customerId: row.customer_id,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
  };
}

/** Every calendar-driven sweep, in one call for the worker. */
export async function sweepAllSchedules(
  db: Db = getDb(),
): Promise<ScheduleSweepResult[]> {
  // Sequential, not `Promise.all`. Each sweep is a full table scan against the
  // same database and running three at once turns one slow tick into three
  // concurrent slow ticks — and the worker has all day.
  const results: ScheduleSweepResult[] = [];
  results.push(await sweepWarrantiesExpiring(db));
  results.push(await sweepContractsExpiring(db));
  results.push(await sweepContractVisitsDue(db));
  return results;
}
