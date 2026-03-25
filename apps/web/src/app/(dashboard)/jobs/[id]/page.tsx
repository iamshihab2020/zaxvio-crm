import { notFound } from "next/navigation";
import { getJob } from "@/actions/jobs";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { JobDetailClient } from "./job-detail-client";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const [jobRes, stagesRes] = await Promise.all([
    getJob(id),
    getPipelineStages(),
  ]);

  if (jobRes.error || !jobRes.data) {
    notFound();
  }

  return (
    <JobDetailClient job={jobRes.data} stages={stagesRes.data ?? []} />
  );
}
