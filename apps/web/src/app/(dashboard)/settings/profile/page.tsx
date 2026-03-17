import type { Metadata } from "next";
import { ProfileSettingsPageClient } from "./profile-settings-page-client";

export const metadata: Metadata = {
  title: "Profile Settings",
  description: "Manage your profile and account settings",
};

export default function ProfileSettingsPage() {
  return <ProfileSettingsPageClient />;
}
