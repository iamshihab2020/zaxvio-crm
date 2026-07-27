"use client";

import { useRouter } from "next/navigation";
import {
  IconCalendarEvent,
  IconArrowsShuffle,
  IconCoin,
  IconUserPlus,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconUsers,
  IconBell,
} from "@tabler/icons-react";
import { formatRelativeTime } from "@/lib/format";
import { bookingLink } from "@/lib/entity-links";

const ICON_MAP: Record<string, React.ElementType> = {
  booking_received: IconCalendarEvent,
  job_status_changed: IconArrowsShuffle,
  invoice_paid: IconCoin,
  customer_created: IconUserPlus,
  quote_accepted: IconCircleCheck,
  quote_declined: IconCircleX,
  invoice_overdue: IconAlertTriangle,
  team_member_joined: IconUsers,
};

const ICON_COLOR_MAP: Record<string, string> = {
  booking_received: "text-blue-500 dark:text-blue-400",
  job_status_changed: "text-brand",
  invoice_paid: "text-green-500 dark:text-green-400",
  customer_created: "text-purple-500 dark:text-purple-400",
  quote_accepted: "text-green-500 dark:text-green-400",
  quote_declined: "text-red-500 dark:text-red-400",
  invoice_overdue: "text-amber-500 dark:text-amber-400",
  team_member_joined: "text-blue-500 dark:text-blue-400",
};

// Entities that have /[id] detail pages
const DETAIL_PAGE_ENTITIES = new Set([
  "customer",
  "job",
  "invoice",
  "quote",
  "asset",
]);

function getEntityLink(
  entityType: string | null,
  entityId: string | null,
): string {
  if (!entityType) return "/dashboard";
  if (entityType === "member") return "/settings/team";
  // Bookings use a sheet opened via query param
  if (entityType === "booking" && entityId) {
    return bookingLink(entityId);
  }
  if (entityId && DETAIL_PAGE_ENTITIES.has(entityType)) {
    return `/${entityType}s/${entityId}`;
  }
  return `/${entityType}s`;
}

interface NotificationItemProps {
  id: string;
  type: string;
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  isRead: boolean;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({
  id,
  type,
  title,
  description,
  entityType,
  entityId,
  createdAt,
  isRead,
  onMarkRead,
}: NotificationItemProps) {
  const router = useRouter();
  const Icon = ICON_MAP[type] ?? IconBell;
  const iconColor = ICON_COLOR_MAP[type] ?? "text-muted-foreground";

  const handleClick = () => {
    if (!isRead) {
      onMarkRead(id);
    }
    const link = getEntityLink(entityType, entityId);
    router.push(link);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isRead ? "bg-muted" : "bg-brand-light"
        }`}
      >
        <Icon className={`h-4 w-4 ${isRead ? "text-muted-foreground" : iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-tight ${
            isRead
              ? "text-muted-foreground font-body"
              : "font-medium text-foreground font-body"
          }`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 font-body">
          {description}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70 font-body">
          {formatRelativeTime(createdAt)}
        </p>
      </div>
      {!isRead && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
      )}
    </button>
  );
}
