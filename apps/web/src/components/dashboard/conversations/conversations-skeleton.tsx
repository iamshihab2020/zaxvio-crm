import { Skeleton } from "@/components/ui/skeleton";

export function ConversationsSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel skeleton */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="px-3 py-2 border-b border-border">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        <div className="flex flex-col divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4">
          <div className="flex justify-start">
            <Skeleton className="h-10 w-48 rounded-2xl rounded-bl-sm" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-56 rounded-2xl rounded-br-sm" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-14 w-64 rounded-2xl rounded-bl-sm" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-40 rounded-2xl rounded-br-sm" />
          </div>
        </div>

        {/* Compose */}
        <div className="border-t border-border px-4 py-3 flex items-center gap-2">
          <Skeleton className="flex-1 h-9 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}
