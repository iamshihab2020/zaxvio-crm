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
    <section className="p-4 sm:p-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Stacks like `ListToolbar` does on a phone: tabs, then search, then
            the button. Fixed 256 + 224 + 144px widths side by side would run
            past a 343px card. */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full sm:h-8 sm:w-64" />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap">
            <Skeleton className="h-10 w-full sm:h-8 sm:w-56" />
            <Skeleton className="ml-auto h-10 w-10 sm:ml-0 sm:h-8 sm:w-36" />
          </div>
        </div>
        <TableSkeleton columns={6} />
      </div>
    </section>
  );
}
