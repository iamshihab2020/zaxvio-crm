"use client";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Says what the catalog charges, and whether this line is charging something
 * else.
 *
 * Picking a catalog item only ever *prefilled* the price — it has always been
 * editable — but nothing on screen said so, so the override looked like it
 * wasn't allowed. And once you did change it, nothing recorded that the line no
 * longer matches the catalog, which is the thing worth seeing when a $100 job
 * goes out at $50.
 *
 * Renders nothing when no catalog item is selected: a hand-typed price has no
 * list price to differ from.
 */
export function CatalogPriceHint({
  catalogPrice,
  currentPrice,
  className,
}: {
  /** The catalog item's list price, or null when none is selected. */
  catalogPrice: string | null;
  /** What the user currently has in the price field. */
  currentPrice: string;
  className?: string;
}) {
  if (!catalogPrice) return null;

  const list = Number(catalogPrice);
  const current = Number(currentPrice);
  if (!Number.isFinite(list)) return null;

  /**
   * Silent while the price matches the catalog.
   *
   * The first cut printed "Catalog price $385" under a field already reading
   * 385.00 — restating a number the eye has just read, on every single add.
   * There is only something to say once the two disagree.
   */
  const hasPrice = currentPrice.trim() !== "" && Number.isFinite(current);
  const delta = current - list;
  if (!hasPrice || Math.abs(delta) < 0.005) return null;

  return (
    <p className={cn("text-[11px] font-body", className)}>
      <span
        className={cn(
          "font-medium",
          delta > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400",
        )}
      >
        {formatCurrency(Math.abs(delta))} {delta > 0 ? "above" : "below"}
      </span>{" "}
      <span className="text-muted-foreground">
        catalog price {formatCurrency(list)}
      </span>
    </p>
  );
}
