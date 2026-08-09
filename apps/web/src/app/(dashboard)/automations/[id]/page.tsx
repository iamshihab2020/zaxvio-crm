import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkflow } from "@/actions/workflows";
import { AutomationDetailPageClient } from "./automation-detail-page-client";

export const metadata: Metadata = {
  title: "Automation",
};

/**
 * The builder.
 *
 * The graph is fetched here rather than in the client so the toolbar renders
 * with the automation's real name and state in the server HTML — the settings
 * sidebar taught this repo what happens otherwise: a control that resolves its
 * own data on mount is absent from the first paint and shoves the layout when
 * it arrives.
 *
 * The canvas itself is `dynamic(..., { ssr: false })` one level down. React
 * Flow measures the DOM on mount and has no server render worth having.
 */
export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getWorkflow(id);

  // `notFound` is a genuine 404, distinguished from a 500 by `api-fetch`
  // carrying `status` out of the transport. Collapsing the two is INV-11: a
  // server error rendering as "this automation does not exist".
  if (result.notFound) notFound();

  return (
    <AutomationDetailPageClient
      id={id}
      initialDetail={result.data}
      initialError={result.error}
    />
  );
}
