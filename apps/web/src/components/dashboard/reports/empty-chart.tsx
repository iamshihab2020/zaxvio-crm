"use client";

/**
 * Placeholder for a chart with no rows in the selected period.
 *
 * Defined once — it was copy-pasted identically into all five tab files.
 * Note this is a genuinely-empty state: a *failed* request is handled by
 * `LoadErrorState` at the page level and never reaches here.
 *
 * It fades in because it usually replaces a chart: a date range with nothing in
 * it is a change the reader should see happen, not a chart that vanished.
 */
export function EmptyChart({ message = "No data for this period" }: { message?: string }) {
  return (
    <div className="motion-appear flex h-[280px] items-center justify-center">
      <p className="text-sm text-muted-foreground font-body">{message}</p>
    </div>
  );
}
