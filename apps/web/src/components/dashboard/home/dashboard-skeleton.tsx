import { Skeleton } from "@/components/ui/skeleton";

function WidgetCard({ height }: { height: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={`mt-4 w-full rounded-xl ${height}`} />
    </div>
  );
}

/**
 * Mirrors the real dashboard grid: 3 KPI pills, a full-width revenue hero, then
 * three two-column rows and two full-width cards.
 *
 * There used to be two skeletons — this one and a separate `loading.tsx` drawing
 * 4 KPI cards with 3-column rows — and neither matched the page, so every load
 * ended in a visible reflow. Both entry points now render this.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Row 1: three KPI pills */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mt-4 h-8 w-28" />
          </div>
        ))}
      </div>

      {/* Row 2: revenue hero */}
      <WidgetCard height="h-[280px]" />

      {/* Rows 3-5: two-column pairs */}
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WidgetCard height="h-[220px]" />
          <WidgetCard height="h-[220px]" />
        </div>
      ))}

      {/* Rows 6-7: full width */}
      <WidgetCard height="h-[180px]" />
      <WidgetCard height="h-[180px]" />
    </div>
  );
}
