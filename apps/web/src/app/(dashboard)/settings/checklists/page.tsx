import type { Metadata } from "next";
import { ChecklistsSettingsClient } from "./checklists-settings-client";

export const metadata: Metadata = {
  title: "Checklist Templates",
  description: "Manage checklist templates for job types",
};

export default function ChecklistSettingsPage() {
  return <ChecklistsSettingsClient />;
}
