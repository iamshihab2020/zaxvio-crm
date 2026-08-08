import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/reusable/table-skeleton";

/**
 * Suspense boundary for the run history.
 *
 * `page.tsx` awaits two requests, and Next will not commit the navigation until
 * they land — so without this file, clicking "Runs" leaves the builder on screen
 * with nothing to say anything happened. That is the settings-sidebar bug
 * exactly: 13 routes under `(dashboard)` had a `loading.tsx` and the one that
 * did not was reported as "the nav takes time to render".
 *
 * Mirrors the real layout so the transition does not jump.
 */
export default function RunsLoading() {
  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-9 w-full max-w-md rounded-lg" />
      <TableSkeleton columns={5} />
    </section>
  );
}
