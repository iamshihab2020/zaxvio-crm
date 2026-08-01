import { ITEM_TYPE_LABELS } from "@/lib/constants/job-options";

/**
 * What a line item is called, resolved exactly as the API resolves it
 * (`apps/api/src/lib/line-items.ts`): what the user typed, then the catalog
 * item it came from, then the item type.
 *
 * The create dialogs need this because they build their line item list locally,
 * before the job or quote exists. Without it, a line the user left unnamed
 * would render blank in the dialog and then arrive from the server with a name
 * — the list would disagree with itself across a save.
 */
export function resolveLineItemDescription(input: {
  description?: string | null;
  catalogName?: string | null;
  itemType: string;
}): string {
  const typed = input.description?.trim();
  if (typed) return typed;

  const fromCatalog = input.catalogName?.trim();
  if (fromCatalog) return fromCatalog;

  return ITEM_TYPE_LABELS[input.itemType] ?? "Item";
}
