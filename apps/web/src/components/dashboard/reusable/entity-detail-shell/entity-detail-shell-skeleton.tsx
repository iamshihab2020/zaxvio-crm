import { Skeleton } from "@/components/ui/skeleton";

export function EntityDetailShellSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {/* Title + badge */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      {/* Action row */}
      <Skeleton className="h-9 w-48" />
      {/* Tab bar */}
      <Skeleton className="h-10 w-full" />
      {/* Content rows */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
