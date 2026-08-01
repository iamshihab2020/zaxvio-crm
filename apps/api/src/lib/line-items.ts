/**
 * Line items are the same shape on jobs, invoices and quotes, and every one of
 * the three had its own rules for the description field: jobs required 1-500
 * chars on update but allowed it to be absent on add, invoices required 1-500
 * on both, quotes accepted an unbounded string — on the field that renders into
 * a **public** quote portal and a PDF. This file is the one definition.
 *
 * The user-facing change: a description is no longer something you have to type.
 * Plenty of lines are just money — a $149 call-out, a $40 disposal fee — and
 * making someone name them before the price is accepted is friction for no gain.
 */

export const ITEM_TYPES = [
  "labor",
  "part",
  "material",
  "service_call",
  "other",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/** Mirrors `ITEM_TYPE_LABELS` in the web app's job-options constants. */
const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  labor: "Labor",
  part: "Part",
  material: "Material",
  service_call: "Service Call",
  other: "Other",
};

export function isItemType(value: unknown): value is ItemType {
  return (
    typeof value === "string" && (ITEM_TYPES as readonly string[]).includes(value)
  );
}

/**
 * What the line is called, in priority order: what the user typed, then the
 * catalog item it came from, then the item type.
 *
 * The column stays `NOT NULL` deliberately. A blank cell on a customer-facing
 * invoice or quote PDF reads as a defect, and every renderer — PDF, email, CSV
 * export, the public quote portal — would need its own null branch. The item
 * type is a field the user has already chosen, so "Service Call · $149.00" is a
 * real label rather than a placeholder standing in for one.
 */
export function resolveLineItemDescription(input: {
  description?: string | null;
  catalogName?: string | null;
  itemType: ItemType;
}): string {
  const typed = input.description?.trim();
  if (typed) return typed;

  const fromCatalog = input.catalogName?.trim();
  if (fromCatalog) return fromCatalog;

  return ITEM_TYPE_LABELS[input.itemType];
}
