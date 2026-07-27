"use client";

/**
 * Placeholder for a chart with no rows in the selected period.
 *
 * Defined once — it was copy-pasted identically into all five tab files.
 * Note this is a genuinely-empty state: a *failed* request is handled by
 * `LoadErrorState` at the page level and never reaches here.
 */
export function EmptyChart({ message = "No data for this period" }: { message?: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <p className="text-sm text-muted-foreground font-body">{message}</p>
    </div>
  );
}
