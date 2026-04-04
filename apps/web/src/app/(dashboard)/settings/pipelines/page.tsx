import type { Metadata } from "next";
import { getPipelines } from "@/actions/pipelines";
import { PipelinesSettingsClient } from "./pipelines-settings-client";

export const metadata: Metadata = {
  title: "Pipelines Settings",
  description: "Manage your job pipelines and stages",
};

export default async function PipelinesSettingsPage() {
  const result = await getPipelines();

  return <PipelinesSettingsClient initialPipelines={(result.data ?? []) as never[]} />;
}
