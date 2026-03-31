import type { Metadata } from "next";
import { NotificationSettingsPageClient } from "./notification-settings-page-client";

export const metadata: Metadata = {
  title: "Notification Settings",
  description: "Manage your notification preferences",
};

export default function NotificationSettingsPage() {
  return <NotificationSettingsPageClient />;
}
