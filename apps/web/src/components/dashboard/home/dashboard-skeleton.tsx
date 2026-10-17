import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardSkeletonProps {
  /**
   * The page already draws the real toolbar above the widget grid while saved
   * widget preferences are read, so that gate asks for the grid only.
   */
  hideToolbar?: boolean;
}

/**
 * Mirrors the *default* dashboard: a toolbar, an overdue banner, four KPI
 * tiles, then the two zones — "Up next" and the week strip on the side,
 * revenue and a pair of mid-size widgets in the main column.
 *
 * The side zone comes first here exactly as it does in the page, so on a phone
 * the skeleton stacks in the order the content will arrive in, and from `xl`
 * it moves to the right third in the same place.
 *
 * There used to be two skeletons — this one and a separate `loading.tsx` drawing
 * 4 KPI cards with 3-column rows — and neither matched the page, so every load
 * ended in a visible reflow. Both entry points now render this, and it tracks
 * the default widget set in `use-dashboard-widget-prefs`: when that changes,
 * change this in the same commit or the reflow comes back.
 */
export function DashboardSkeleton({ hideToolbar = false }: DashboardSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Toolbar: the date line and freshness on the left, two controls (40px
          squares on a phone) on the right. */}
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="hidden h-4 w-28 sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 sm:h-8 sm:w-28" />
            <Skeleton className="h-10 w-10 sm:h-8 sm:w-24" />
          </div>
        </div>
      )}

      {/* Overdue banner. Taller on a phone, where its button drops underneath. */}
      <Skeleton className="h-[134px] w-full rounded-lg sm:h-20" />

      {/* Four KPI tiles: two across on a phone, four from `lg`. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3 sm:p-4 lg:p-5">
            <Skeleton className="h-8 w-8 rounded-full sm:h-9 sm:w-9" />
            <Skeleton className="mt-3 h-6 w-20 sm:mt-4 sm:h-7 lg:h-8 lg:w-28" />
            <Skeleton className="mt-2 h-4 w-24" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Side zone */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-start-3 xl:row-start-1">
          {/* Up next: header, the "Today" label, then six 48px rows on the
              4rem time column. */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-4 h-3 w-12" />
            <div className="mt-3 space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3">
                  <Skeleton className="mt-2 h-3 w-12" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          </Card>

          {/* Week ahead */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-4 h-[180px] w-full" />
          </Card>
        </div>

        {/* Main zone */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2 xl:col-start-1 xl:row-start-1">
          {/* Revenue: title and range tabs, the headline figure, the chart. */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-full sm:h-8 sm:w-64" />
            </div>
            <Skeleton className="mt-4 h-8 w-40" />
            <Skeleton className="mt-4 h-[200px] w-full sm:h-[260px]" />
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-4 sm:p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-4 h-[220px] w-full" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
