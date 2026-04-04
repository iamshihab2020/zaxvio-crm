import type { Metadata } from "next";
import { getPipelines } from "@/actions/pipelines";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { getJobs } from "@/actions/jobs";
import { getTenant } from "@/actions/tenants";
import { JobsPageClient } from "./jobs-page-client";

export const metadata: Metadata = {
  title: "Jobs",
};

export default async function JobsPage() {
  // Fetch pipelines + tenant in parallel (no dependencies between them)
  const [pipelinesResult, tenantResult] = await Promise.all([
    getPipelines(),
    getTenant(),
  ]);

  const pipelines = (pipelinesResult.data ?? []) as {
    id: string;
    name: string;
    label: string;
    isDefault: boolean;
    stageCount: number;
    jobCount: number;
  }[];

  const defaultTaxRate = tenantResult.data?.defaultTaxRate as string | undefined;

  // Resolve default pipeline
  const defaultPipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const defaultPipelineId = defaultPipeline?.id ?? null;

  // Fetch jobs + stages for default pipeline in parallel
  let initialJobs: unknown[] = [];
  let initialStages: unknown[] = [];

  if (defaultPipelineId) {
    const [jobsResult, stagesResult] = await Promise.all([
      getJobs({
        pipelineId: defaultPipelineId,
        limit: 150,
        sortBy: "scheduledDate",
        sortOrder: "asc",
      }),
      getPipelineStages(defaultPipelineId),
    ]);
    initialJobs = jobsResult.data ?? [];
    initialStages = stagesResult.data ?? [];
  }

  return (
    <JobsPageClient
      initialPipelines={pipelines}
      initialJobs={initialJobs}
      initialStages={initialStages}
      initialPipelineId={defaultPipelineId}
      defaultTaxRate={defaultTaxRate}
    />
  );
}
