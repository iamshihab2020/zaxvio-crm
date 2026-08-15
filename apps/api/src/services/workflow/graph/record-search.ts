/**
 * Search for a record to put in a node's config.
 *
 * ## Why this is not part of `builder-context`
 *
 * That endpoint ships small closed sets — members, pipelines, stages, tags —
 * on node open. Customers, jobs, equipment and contracts have no ceiling: a
 * tenant three years in has thousands, and preloading them would make opening a
 * node slower the longer somebody has been a customer.
 *
 * ## One shape for every kind
 *
 * Each kind resolves to `{id, label, sublabel}`. The picker component is then
 * one component rather than four, and — more to the point — *adding* a kind
 * cannot produce a picker that renders differently from the others by accident.
 * `sublabel` is what disambiguates two rows with the same name, which is the
 * entire job of a search result: "John Smith" twice is useless, "John Smith ·
 * 12 Oak St" is not.
 *
 * ## The tenant predicate is not optional and not inferred
 *
 * Every branch below filters on `tenantId` in the `WHERE`, and the search term
 * goes through `escapeLike` — a customer named `100%` must not match every row.
 * Both were real defects in this repo (the 2026-08-06 audit, and `escapeLike`'s
 * own history in `routes/jobs`), which is why they are stated here rather than
 * assumed.
 */

import {
  customers,
  equipment,
  jobs,
  maintenanceContracts,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type getDb,
} from "@hvac-saas/database";
import type { SearchableKind } from "@hvac-saas/workflow-nodes";
import { escapeLike } from "../../../lib/search.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

// `SearchableKind` is declared in `@hvac-saas/workflow-nodes`, because the Zod
// query schema, this switch and the browser picker all have to agree on it. A
// second copy here would let the three drift, and the drift is silent: a `kind`
// this file does not handle falls out of the switch as `undefined`, which the
// picker renders as an empty list.

export interface RecordOption {
  id: string;
  label: string;
  /** Disambiguator — an address, a job number, a serial. Never decorative. */
  sublabel: string | null;
}

const LIMIT = 20;

export async function searchRecords(
  db: Db,
  args: { tenantId: string; kind: SearchableKind; query: string; ids?: string[] },
): Promise<RecordOption[]> {
  const { tenantId, kind, ids } = args;
  const term = args.query.trim();

  // `ids` is the **rehydrate** path, not the search path. A saved config holds
  // an id; the panel has to show a name for it on open, and it has no search
  // term to find it with. Without this the picker would render a bare uuid — or
  // worse, an empty control, which reads as "nothing is configured" on a node
  // that is configured.
  if (ids && ids.length > 0) {
    return byIds(db, tenantId, kind, ids.slice(0, LIMIT));
  }

  // An empty term returns the most recent rows rather than nothing. Opening a
  // picker and seeing a blank list reads as "there are none".
  const pattern = term ? `%${escapeLike(term)}%` : null;

  switch (kind) {
    case "customer": {
      const rows = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          address: customers.address,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            pattern
              ? or(
                  ilike(customers.firstName, pattern),
                  ilike(customers.lastName, pattern),
                  ilike(customers.email, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(asc(customers.lastName), asc(customers.firstName))
        .limit(LIMIT);
      return rows.map((r) => ({
        id: r.id,
        label: `${r.firstName} ${r.lastName}`.trim(),
        // Email over address: two people at one address share a surname far
        // more often than they share an inbox.
        sublabel: r.email ?? r.address ?? null,
      }));
    }

    case "job": {
      const rows = await db
        .select({
          id: jobs.id,
          jobNumber: jobs.jobNumber,
          title: jobs.title,
          status: jobs.status,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.tenantId, tenantId),
            pattern
              ? or(ilike(jobs.title, pattern), ilike(jobs.jobNumber, pattern))
              : undefined,
          ),
        )
        .orderBy(desc(jobs.createdAt))
        .limit(LIMIT);
      return rows.map((r) => ({
        id: r.id,
        label: r.title,
        sublabel: [r.jobNumber, r.status].filter(Boolean).join(" · ") || null,
      }));
    }

    case "equipment": {
      // There is no `name` column. An asset is identified by what it is plus
      // whose it is — "Carrier 58STA" means nothing on its own in a list of
      // forty. Brand and model compose the label; the serial disambiguates two
      // identical units at one address.
      const rows = await db
        .select({
          id: equipment.id,
          equipmentType: equipment.equipmentType,
          brand: equipment.brand,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
          location: equipment.location,
        })
        .from(equipment)
        .where(
          and(
            eq(equipment.tenantId, tenantId),
            isNull(equipment.archivedAt),
            pattern
              ? or(
                  ilike(equipment.equipmentType, pattern),
                  ilike(equipment.brand, pattern),
                  ilike(equipment.model, pattern),
                  ilike(equipment.serialNumber, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(asc(equipment.equipmentType))
        .limit(LIMIT);
      return rows.map((r) => ({
        id: r.id,
        label: equipmentLabel(r),
        sublabel: r.serialNumber ?? r.location ?? null,
      }));
    }

    case "contract": {
      const rows = await db
        .select({
          id: maintenanceContracts.id,
          contractName: maintenanceContracts.contractName,
          endDate: maintenanceContracts.endDate,
          isActive: maintenanceContracts.isActive,
        })
        .from(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            pattern ? ilike(maintenanceContracts.contractName, pattern) : undefined,
          ),
        )
        .orderBy(asc(maintenanceContracts.contractName))
        .limit(LIMIT);
      return rows.map((r) => ({
        id: r.id,
        label: r.contractName,
        // "Ends 2026-12-31" is the thing that separates this year's contract
        // from last year's under the same name, which is how they are named.
        sublabel: r.isActive === false ? `Inactive · ends ${r.endDate}` : `Ends ${r.endDate}`,
      }));
    }
  }
}

/** `Carrier 58STA` / `Furnace` — brand and model when present, type otherwise. */
function equipmentLabel(row: {
  equipmentType: string;
  brand: string | null;
  model: string | null;
}): string {
  const made = [row.brand, row.model].filter(Boolean).join(" ");
  return made ? `${made} (${row.equipmentType})` : row.equipmentType;
}

/** Rehydrate saved ids into labels. Same tenant predicate, same shape. */
async function byIds(
  db: Db,
  tenantId: string,
  kind: SearchableKind,
  ids: string[],
): Promise<RecordOption[]> {
  switch (kind) {
    case "customer": {
      const rows = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
        })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, ids)));
      return rows.map((r) => ({
        id: r.id,
        label: `${r.firstName} ${r.lastName}`.trim(),
        sublabel: r.email ?? null,
      }));
    }
    case "job": {
      const rows = await db
        .select({ id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, ids)));
      return rows.map((r) => ({
        id: r.id,
        label: r.title,
        sublabel: r.jobNumber || null,
      }));
    }
    case "equipment": {
      const rows = await db
        .select({
          id: equipment.id,
          equipmentType: equipment.equipmentType,
          brand: equipment.brand,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
        })
        .from(equipment)
        .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, ids)));
      return rows.map((r) => ({
        id: r.id,
        label: equipmentLabel(r),
        sublabel: r.serialNumber ?? null,
      }));
    }
    case "contract": {
      const rows = await db
        .select({
          id: maintenanceContracts.id,
          contractName: maintenanceContracts.contractName,
        })
        .from(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            inArray(maintenanceContracts.id, ids),
          ),
        );
      return rows.map((r) => ({ id: r.id, label: r.contractName, sublabel: null }));
    }
  }
}
