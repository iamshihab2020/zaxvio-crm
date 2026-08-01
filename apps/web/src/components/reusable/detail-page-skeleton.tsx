import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading state for a full-page entity detail route (`/jobs/[id]`,
 * `/quotes/[id]`, `/invoices/[id]`, `/assets/[id]`, `/customers/[id]`).
 *
 * Next.js applies a segment's `loading.tsx` to its children, so every one of
 * these routes was rendering its **list** page's skeleton — `/jobs/[id]` drew
 * four columns of Kanban cards, then swapped them for a three-panel detail
 * page. A loading state that shows the wrong page is worse than no loading
 * state: it tells the reader they opened something they did not.
 *
 * The panel widths here are the ones in the detail clients — `lg:w-80` for the
 * info column, `xl` and `w-72` for the sidebar — so the skeleton lands where
 * the content lands, at every breakpoint.
 */

interface DetailPageSkeletonProps {
  /** Left info column. Off for pages that are a single panel (customers). */
  info?: boolean;
  /** Right rail, `xl` and up. Off for pages that do not have one. */
  sidebar?: boolean;
  /** Rows of content in the main panel. */
  rows?: number;
  /** Tabs across the top of the main panel. 0 for none. */
  tabs?: number;
  className?: string;
}

export function DetailPageSkeleton({
  info = true,
  sidebar = false,
  rows = 5,
  tabs = 5,
  className,
}: DetailPageSkeletonProps) {
  return (
    <div
      className={cn("flex min-h-[calc(100vh-3.5rem)] flex-col", className)}
      aria-busy="true"
      aria-label="Loading"
    >
      {/* Header bar: breadcrumb, title, status badges, actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-10" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start">
          {info && (
            <div className="w-full shrink-0 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:w-80">
              <Skeleton className="h-4 w-24" />
              <div className="mt-4 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            {tabs > 0 && (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: tabs }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-md" />
                ))}
              </div>
            )}
            <div className={cn("space-y-3", tabs > 0 && "mt-5")}>
              {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>

          {sidebar && (
            <div className="hidden w-72 shrink-0 rounded-lg border border-border bg-card p-4 shadow-sm xl:block">
              <Skeleton className="h-4 w-28" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
