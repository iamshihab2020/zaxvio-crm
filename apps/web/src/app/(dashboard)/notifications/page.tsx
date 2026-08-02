import type { Metadata } from "next";
import { getNotifications } from "@/actions/notifications";
import { NotificationsPageClient } from "./notifications-page-client";
import type { NotificationWithReadStatus } from "@hvac-saas/types";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View all your notifications",
};

export default async function NotificationsPage() {
  const result = await getNotifications({ limit: 50 });

  return (
    <NotificationsPageClient
      initialNotifications={(result.data ?? []) as NotificationWithReadStatus[]}
      initialNextCursor={result.nextCursor}
    />
  );
}
