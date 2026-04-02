import type { Metadata } from "next";
import { PipelinesSettingsClient } from "./pipelines-settings-client";

export const metadata: Metadata = {
  title: "Pipelines Settings",
  description: "Manage your job pipelines and stages",
};

export default function PipelinesSettingsPage() {
  return <PipelinesSettingsClient />;
}
