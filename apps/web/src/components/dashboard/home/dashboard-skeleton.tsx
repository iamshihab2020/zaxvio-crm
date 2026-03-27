"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-1 h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-52 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* KPI Grid skeleton — 4 cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="mt-2 h-7 w-20" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-md" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto h-[180px] w-[180px] rounded-full" />
            <div className="mt-3 flex justify-center gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-16" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Widgets row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-3 w-40" />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0"
              >
                <Skeleton className="h-3 w-14" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Invoice Aging */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-1 h-3 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quote Conversion */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-3 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto h-[140px] w-[140px] rounded-full" />
            <div className="mt-3 flex justify-center gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-16" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 border-b border-border px-4 py-2 last:border-0"
            >
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
