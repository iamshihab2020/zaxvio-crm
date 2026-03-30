import type { Metadata } from "next";
import { TeamSettingsClient } from "./team-settings-client";

export const metadata: Metadata = {
  title: "Team Settings",
  description: "Manage your team members and invitations",
};

export default function TeamSettingsPage() {
  return <TeamSettingsClient />;
}
