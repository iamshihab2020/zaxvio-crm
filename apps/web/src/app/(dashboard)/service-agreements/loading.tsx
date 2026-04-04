import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ServiceAgreementsLoading() {
  return (
    <section className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Table card */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-9 w-64 rounded-md" />
        </div>
        <TableSkeleton columns={6} rows={8} />
      </div>
    </section>
  );
}
