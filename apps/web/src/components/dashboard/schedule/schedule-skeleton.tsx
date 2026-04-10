"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ScheduleSkeleton() {
  return (
    <section className="flex flex-col h-[calc(100vh-3.5rem)] p-4 gap-0">
      {/* Page header skeleton */}
      <div className="pb-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Task panel skeleton */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          {/* Task items */}
          <div className="p-2 space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg">
                <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-4 w-10 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Calendar card skeleton */}
        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Toolbar skeleton */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-7 w-28 rounded-lg" />
            </div>
          </div>

          {/* Filters skeleton */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>

          {/* Calendar grid skeleton */}
          <div className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-8 border-b border-border">
              <div className="w-16" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="border-l border-border px-2 py-3">
                  <Skeleton className="mx-auto h-4 w-12" />
                </div>
              ))}
            </div>

            {/* Time grid rows */}
            {Array.from({ length: 10 }).map((_, row) => (
              <div
                key={row}
                className="grid grid-cols-8 border-b border-border"
                style={{ height: 72 }}
              >
                <div className="flex items-start justify-end px-2 pt-1">
                  <Skeleton className="h-3 w-10" />
                </div>
                {Array.from({ length: 7 }).map((_, col) => (
                  <div key={col} className="relative border-l border-border">
                    {row === 1 && col === 2 && (
                      <Skeleton className="absolute inset-x-1 top-1 h-16 rounded-lg" />
                    )}
                    {row === 3 && col === 0 && (
                      <Skeleton className="absolute inset-x-1 top-1 h-12 rounded-lg" />
                    )}
                    {row === 5 && col === 4 && (
                      <Skeleton className="absolute inset-x-1 top-1 h-16 rounded-lg" />
                    )}
                    {row === 2 && col === 6 && (
                      <Skeleton className="absolute inset-x-1 top-1 h-10 rounded-lg" />
                    )}
                    {row === 7 && col === 1 && (
                      <Skeleton className="absolute inset-x-1 top-1 h-14 rounded-lg" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
