import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/reusable/table-skeleton";

/**
 * The Suspense boundary for `/automations`.
 *
 * Present from the first commit, not added later. `page.tsx` is an async server
 * component awaiting a server action, and Next will not commit the navigation
 * until the RSC payload lands — so without this file, clicking Automations
 * leaves the previous page on screen with the previous nav item highlighted.
 * That was the settings-sidebar bug, reported as "the sidebar is slow" when the
 * sidebar was innocent and the destination was blocking it.
 */
export default function AutomationsLoading() {
  return (
    <section className="p-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-64" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>
        <TableSkeleton columns={6} />
      </div>
    </section>
  );
}
