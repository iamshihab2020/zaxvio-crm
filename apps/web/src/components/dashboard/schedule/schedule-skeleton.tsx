"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Schedule page while it loads, in the page's own shapes: a task column
 * from `xl`, the toolbar as two rows on a phone and one from `md`, the filter
 * row from `md`, and the view a first visit opens on: the day (with its week
 * strip) on a phone, the week from `md`. Breakpoints here stand in for the
 * card-width container queries the real page uses, which a skeleton without
 * the sidebar's state cannot know.
 */
export function ScheduleSkeleton() {
  return (
    <section className="flex flex-col h-[calc(100dvh-3.5rem)] p-4 gap-0">
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Task panel skeleton */}
        <div className="hidden xl:flex w-72 shrink-0 flex-col rounded-lg border border-border bg-card">
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
          {/* Toolbar skeleton: navigation and New Event, then the date, the
              filters button and the view switcher; one row from md. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 border-b border-border px-3 py-1.5 sm:px-4 md:flex md:py-3.5">
            <div className="col-start-1 row-start-1 flex items-center gap-1.5">
              <Skeleton className="h-10 w-10 sm:h-8 sm:w-8" />
              <Skeleton className="h-10 w-16 sm:h-8" />
              <Skeleton className="h-10 w-10 sm:h-8 sm:w-8" />
              <Skeleton className="h-10 w-10 sm:h-8 sm:w-8" />
            </div>
            <Skeleton className="col-start-1 row-start-2 ml-2 h-5 w-28 md:w-40" />
            <Skeleton className="col-start-2 row-start-1 ml-auto h-10 w-10 sm:h-8 sm:w-24" />
            <div className="col-start-2 row-start-2 flex items-center gap-1.5">
              <Skeleton className="h-10 w-10 sm:h-8 sm:w-8 md:hidden" />
              <Skeleton className="h-10 w-[7.75rem] rounded-lg sm:h-8 sm:w-48" />
            </div>
          </div>

          {/* Filters skeleton */}
          <div className="hidden items-center gap-2 border-b border-border px-4 py-2 md:flex">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>

          {/* Week strip: the day view's, on a phone */}
          <div className="grid grid-cols-7 gap-0.5 border-b border-border px-1.5 py-1 md:hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex min-h-14 flex-col items-center justify-center gap-1">
                <Skeleton className="h-2.5 w-6" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            ))}
          </div>

          {/* Calendar grid skeleton. A phone opens on the day view, so it gets
              one day column; from md the week's seven. */}
          <div className="p-0">
            {/* Day headers, from md only: the day view has none */}
            <div className="hidden grid-cols-8 border-b border-border md:grid">
              <div className="w-16" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1 border-l border-border px-2 py-1.5">
                  <Skeleton className="h-2.5 w-7" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              ))}
            </div>

            {/* Time grid rows */}
            {Array.from({ length: 10 }).map((_, row) => (
              <div
                key={row}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)] border-b border-border md:grid-cols-8"
                style={{ height: 72 }}
              >
                <div className="flex items-start justify-end px-1 pt-1 md:px-2">
                  <Skeleton className="h-3 w-8 md:w-10" />
                </div>
                {Array.from({ length: 7 }).map((_, col) => (
                  <div
                    key={col}
                    className={`relative border-l border-border ${col > 0 ? "hidden md:block" : ""}`}
                  >
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
