import { notFound } from "next/navigation";
import { getJob } from "@/actions/jobs";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { JobDetailClient } from "./job-detail-client";
import { JobLoadError } from "./job-load-error";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;

  // Sequential, not Promise.all: the stage list depends on which pipeline this
  // job is on. `getPipelineStages()` with no argument resolves the tenant's
  // *default* pipeline, so a job on any other pipeline was handed the wrong
  // columns — offering stages it could never be in, and omitting the one it was
  // actually in.
  const jobRes = await getJob(id);

  // A 404 is the only result that means "no such job". Anything else is an
  // outage, and rendering "This page could not be found" for an outage is a
  // definitive claim about the user's data made on the strength of a 500.
  if (jobRes.status === 404) {
    notFound();
  }
  if (jobRes.error || !jobRes.data) {
    return <JobLoadError message={jobRes.error} />;
  }

  const job = jobRes.data as { pipelineId?: string | null };
  const stagesRes = await getPipelineStages(job.pipelineId ?? undefined);

  return (
    <JobDetailClient job={jobRes.data} stages={stagesRes.data ?? []} />
  );
}
