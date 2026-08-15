/**
 * CRM enums mirrored from the database, for the builder and the node registry.
 *
 * ## Why mirrored rather than imported
 *
 * `packages/database` pulls in Drizzle and a driver. This package is imported by
 * the **browser** — the graph validator runs client-side so the builder can
 * report problems without a round trip — so it cannot depend on it. The mirror
 * is the price of that, and the mitigation is that each list is declared here
 * exactly once and every consumer reads it from here.
 *
 * ## The failure this prevents
 *
 * Three trigger definitions each wrote out the service-type list by hand. That
 * is not a style problem — a filter whose options do not match the payload's
 * enum matches **nothing, silently**, which is precisely the failure the
 * declarative filter design exists to prevent. It has already happened twice in
 * this feature: the `customer.created` source filter was written against a
 * guessed enum (`booking_portal` for the schema's `booking`), and a job priority
 * filter offered "Low"/"High" against an enum of
 * `standard | urgent | emergency`. Neither errored. Both matched no records.
 *
 * **If you add a value to a `pgEnum` that appears here, add it here in the same
 * commit.** There is no compiler edge between the two.
 */

import type { NodePropertyOption } from "./node-definition.js";

/** Mirrors `serviceTypeEnum` in `packages/database/src/schema/enums.ts`. */
export const SERVICE_TYPES = [
  "installation",
  "repair",
  "maintenance",
  "inspection",
  "emergency",
  "consultation",
  "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Mirrors `jobPriorityEnum`. Not `low`/`normal`/`high` — that guess shipped. */
export const JOB_PRIORITIES = ["standard", "urgent", "emergency"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

/**
 * Mirrors `serviceFrequencyEnum`.
 *
 * Exported as a **type** as well as a list because a producer has to
 * re-establish it: the schedule sweep casts `frequency::text` in SQL, so the
 * value arrives as a bare `string` and the payload schema declares a closed
 * enum. A `string` reaching that parse drops the event silently, which is the
 * quietest possible way to make an automation never fire.
 */
export const SERVICE_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
] as const;
export type ServiceFrequency = (typeof SERVICE_FREQUENCIES)[number];

/** Mirrors `itemTypeEnum`. */
export const ITEM_TYPES = [
  "labor",
  "part",
  "service_call",
  "material",
  "other",
] as const;

/** The four lifecycles a job stage maps onto. Renaming a column cannot change these. */
export const JOB_LIFECYCLES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

/**
 * `installation` → `{ name: "Installation", value: "installation" }`.
 *
 * Definitions call this rather than writing option arrays, so the display label
 * and the stored value cannot drift apart per node.
 */
export function enumOptions(
  values: readonly string[],
  overrides: Record<string, string> = {},
): NodePropertyOption[] {
  return values.map((value) => ({
    name: overrides[value] ?? titleCaseEnum(value),
    value,
  }));
}

function titleCaseEnum(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
