import { KanbanSkeleton } from "@/components/dashboard/jobs/kanban-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <section className="px-4 pt-3 pb-0 sm:px-5 sm:pt-2.5">
      {/* The toolbar card, placed exactly as the real one is
          (jobs-page-client.tsx): two lines on a phone, one row from `sm`. In
          order: pipeline, search, view switch, Display, New Job. It was a bare
          title and two buttons, a page this one never becomes. */}
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-border/60 bg-card px-2 py-2 shadow-sm dark:border-border/40 dark:bg-muted/15 dark:shadow-none sm:mb-4 sm:flex sm:py-1.5">
        <Skeleton className="h-10 rounded-lg sm:h-7 sm:w-28" />
        <Skeleton className="col-span-2 row-start-2 h-10 rounded-md sm:ml-4 sm:h-7 sm:w-52" />
        <Skeleton className="col-start-2 row-start-1 h-10 w-32 rounded-lg sm:mx-auto sm:h-7 sm:w-48" />
        <Skeleton className="col-start-3 row-start-2 h-10 w-10 rounded-lg sm:h-7 sm:w-[4.5rem]" />
        <Skeleton className="col-start-3 row-start-1 h-10 w-10 rounded-lg sm:ml-1 sm:h-7 sm:w-20" />
      </div>
      <KanbanSkeleton columnCount={4} />
    </section>
  );
}
