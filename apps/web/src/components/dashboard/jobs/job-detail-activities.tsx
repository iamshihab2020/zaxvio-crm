"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  IconActivity,
  IconPlus as IconCreated,
  IconEdit,
  IconArrowsShuffle,
  IconChecklist,
  IconPhoto,
  IconPackage,
} from "@tabler/icons-react";
import { getJobActivities } from "@/actions/jobs";

interface Activity {
  id: string;
  type: string;
  description: string;
  metadata: unknown;
  performerName: string | null;
  createdAt: string;
}

interface JobDetailActivitiesProps {
  jobId: string;
}

const typeIconMap: Record<string, React.ReactNode> = {
  "job.created": <IconCreated className="h-4 w-4 text-green-600" />,
  "job.updated": <IconEdit className="h-4 w-4 text-blue-600" />,
  "job.status_changed": <IconArrowsShuffle className="h-4 w-4 text-brand" />,
  "checklist.attached": <IconChecklist className="h-4 w-4 text-purple-600" />,
  "checklist.item_completed": <IconChecklist className="h-4 w-4 text-green-600" />,
  "line_item.added": <IconPackage className="h-4 w-4 text-blue-600" />,
  "line_item.updated": <IconPackage className="h-4 w-4 text-amber-600" />,
  "line_item.removed": <IconPackage className="h-4 w-4 text-red-600" />,
  "photo.uploaded": <IconPhoto className="h-4 w-4 text-brand" />,
  "photo.deleted": <IconPhoto className="h-4 w-4 text-red-600" />,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function JobDetailActivities({ jobId }: JobDetailActivitiesProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    getJobActivities(jobId, { page: 1, limit: 20 }).then((res) => {
      if (res.data) {
        setActivities(res.data);
        setHasMore((res.pagination?.totalPages ?? 1) > 1);
      }
      setLoading(false);
    });
  }, [jobId]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    const res = await getJobActivities(jobId, { page: nextPage, limit: 20 });
    if (res.data) {
      setActivities((prev) => [...prev, ...res.data]);
      setPage(nextPage);
      setHasMore((res.pagination?.totalPages ?? 1) > nextPage);
    }
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
        <IconActivity className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground font-body">
          No activity yet
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-0">
        {activities.map((activity, idx) => (
          <div
            key={activity.id}
            className="flex gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-muted/30 transition-colors"
          >
            <div className="relative flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted ring-2 ring-card">
                {typeIconMap[activity.type] ?? (
                  <IconActivity className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              {idx < activities.length - 1 && (
                <div className="w-px flex-1 bg-border/60 mt-1" />
              )}
            </div>
            <div className="flex-1 pb-1">
              <p className="text-sm text-foreground font-body">
                {activity.description}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activity.performerName && (
                  <span>{activity.performerName} &middot; </span>
                )}
                {timeAgo(activity.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            className="cursor-pointer"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
