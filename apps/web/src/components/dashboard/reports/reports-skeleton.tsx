"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 border-b border-border pb-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>

      {/* Tab content skeleton */}
      <ReportsTabSkeleton />
    </div>
  );
}

export function ReportsTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI row — four cards, matching the widest tab. It used to render five,
          so every tab reflowed the moment real data arrived. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>

      {/* Table area */}
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
