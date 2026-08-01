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
 * Mirrors the *default* dashboard: an overdue banner, four KPI pills, the
 * revenue hero, the week strip, then one three-up row of mid-size widgets.
 *
 * There used to be two skeletons — this one and a separate `loading.tsx` drawing
 * 4 KPI cards with 3-column rows — and neither matched the page, so every load
 * ended in a visible reflow. Both entry points now render this, and it tracks
 * the default widget set in `use-dashboard-widget-prefs`: when that changes,
 * change this in the same commit or the reflow comes back.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Overdue banner */}
      <Skeleton className="h-[72px] w-full rounded-2xl" />

      {/* Row 1: four KPI pills */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="mt-5 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Row 2: revenue hero */}
      <WidgetCard height="h-[280px]" />

      {/* Row 3: week ahead strip */}
      <WidgetCard height="h-[124px]" />

      {/* Row 4: mid-size widgets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <WidgetCard key={i} height="h-[280px]" />
        ))}
      </div>
    </div>
  );
}
