import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkflow, getWorkflowRuns } from "@/actions/workflows";
import { AutomationRunsPageClient } from "./runs-page-client";

export const metadata: Metadata = {
  title: "Automation runs",
};

/**
 * Run history for one automation.
 *
 * Its own route rather than a tab inside the builder, for two reasons. A failed
 * run is the thing somebody wants to send a link to, and a URL is the only way
 * to do that. And the builder holds unsaved work in a client store — swapping
 * the canvas out for a table underneath it invites exactly the accident the
 * store's id-keyed load guard exists to prevent.
 *
 * Both requests are issued together: the page needs the automation's name for
 * its header regardless, and running them in sequence would be [[architecture|ARC-18]]'s
 * sequential-await defect on a brand new page.
 */
export default async function AutomationRunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string; status?: string }>;
}) {
  const { id } = await params;
  const { run, status } = await searchParams;

  const [detail, firstPage] = await Promise.all([
    getWorkflow(id),
    getWorkflowRuns(id, { page: 1, limit: 20, status }),
  ]);

  // A genuine 404, kept distinct from a 500 by `api-fetch` carrying `status`
  // out of the transport. Collapsing the two is INV-11 — a server error
  // rendering as "this automation does not exist".
  if (detail.notFound) notFound();

  return (
    <AutomationRunsPageClient
      id={id}
      workflowName={detail.data?.workflow.name ?? "Automation"}
      initialRuns={firstPage.data}
      initialError={firstPage.error}
      initialRunId={run ?? null}
      initialStatus={status ?? "all"}
    />
  );
}
