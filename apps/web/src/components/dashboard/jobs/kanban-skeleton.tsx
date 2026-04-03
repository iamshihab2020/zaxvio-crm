"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface KanbanSkeletonProps {
  columnCount?: number;
}

export function KanbanSkeleton({ columnCount = 4 }: KanbanSkeletonProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: columnCount }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="rounded-xl border border-border/50 dark:border-border/40 bg-muted/40 dark:bg-muted/10 p-3 min-w-[290px] flex-1"
        >
          {/* Header skeleton */}
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-lg" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          {/* Card skeletons */}
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="rounded-xl border border-border/80 dark:border-border/60 bg-card shadow dark:shadow-sm p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-4 w-14 rounded-md" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-16" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
