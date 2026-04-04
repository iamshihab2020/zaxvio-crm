import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <section className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36 rounded-md" />
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
