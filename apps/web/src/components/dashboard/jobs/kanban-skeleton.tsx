"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface KanbanSkeletonProps {
  columnCount?: number;
}

export function KanbanSkeleton({ columnCount = 4 }: KanbanSkeletonProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: columnCount }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="rounded-lg border-t-[3px] border border-border border-t-muted-foreground/20 bg-muted/20 p-3 min-w-[280px] flex-1"
        >
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-5 w-6 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="rounded-md border border-border border-l-[3px] border-l-muted-foreground/20 bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                {/* Service type chip skeleton */}
                <Skeleton className="h-4 w-16 rounded-md" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
