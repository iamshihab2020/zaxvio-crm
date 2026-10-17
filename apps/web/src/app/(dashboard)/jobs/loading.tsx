import { KanbanSkeleton } from "@/components/dashboard/jobs/kanban-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <section className="px-4 pt-3 pb-0 sm:px-5 sm:pt-2.5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      {/* Kanban board */}
      <KanbanSkeleton columnCount={4} />
    </section>
  );
}
