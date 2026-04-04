import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <section className="flex flex-col h-[calc(100vh-3.5rem)] p-4 gap-0">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      {/* Calendar grid */}
      <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-3 py-2 border-r border-border last:border-r-0">
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
        {/* Calendar rows */}
        {Array.from({ length: 5 }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {Array.from({ length: 7 }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-24 p-2 border-r border-border last:border-r-0 space-y-1"
              >
                <Skeleton className="h-4 w-6" />
                {rowIdx < 3 && colIdx % 2 === 0 && (
                  <Skeleton className="h-5 w-full rounded" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
