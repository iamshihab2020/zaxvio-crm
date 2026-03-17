"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerActivities } from "@/actions/customers";
import {
  IconUserPlus,
  IconEdit,
  IconNote,
  IconActivity,
} from "@tabler/icons-react";

interface Activity {
  id: string;
  type: string;
  description: string;
  metadata: unknown;
  performerName: string | null;
  createdAt: string;
}

interface CustomerActivityTabProps {
  customerId: string;
  refreshKey?: number;
}

const typeIconMap: Record<string, React.ReactNode> = {
  "customer.created": <IconUserPlus className="h-4 w-4 text-green-600" />,
  "customer.updated": <IconEdit className="h-4 w-4 text-blue-600" />,
  "note.created": <IconNote className="h-4 w-4 text-amber-600" />,
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

export function CustomerActivityTab({ customerId, refreshKey }: CustomerActivityTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerActivities(customerId, { limit: 50 }).then((res) => {
      if (res.data) setActivities(res.data);
      setLoading(false);
    });
  }, [customerId, refreshKey]);

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
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
          <IconActivity className="h-5 w-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground font-body">
          No activity yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Activity for this customer will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, idx) => (
        <div
          key={activity.id}
          className="flex gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-muted/30 transition-colors"
        >
          <div className="relative flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt ring-2 ring-card">
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
  );
}
