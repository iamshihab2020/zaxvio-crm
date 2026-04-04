import type { Metadata } from "next";
import { getNotificationPreferences } from "@/actions/notifications";
import { NotificationSettingsPageClient } from "./notification-settings-page-client";

export const metadata: Metadata = {
  title: "Notification Settings",
  description: "Manage your notification preferences",
};

export default async function NotificationSettingsPage() {
  const result = await getNotificationPreferences();

  return <NotificationSettingsPageClient initialPreferences={(result.data ?? []) as never[]} />;
}
