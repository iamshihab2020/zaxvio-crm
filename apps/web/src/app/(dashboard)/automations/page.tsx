import type { Metadata } from "next";
import { getWorkflows } from "@/actions/workflows";
import { AutomationsPageClient } from "./automations-page-client";

export const metadata: Metadata = {
  title: "Automations",
  description: "Run work automatically when something happens in your business",
};

/** Mirrors the client's first-render params exactly, or the seed is discarded. */
const INITIAL_PARAMS = { page: 1, limit: 20 } as const;

export default async function AutomationsPage() {
  const result = await getWorkflows(INITIAL_PARAMS);

  return (
    <AutomationsPageClient
      // No cast: `getWorkflows` is typed with the wire shape, so what the server
      // rendered and what the client expects are the same declaration.
      initialWorkflows={result.data ?? []}
      initialTotal={result.pagination?.total ?? 0}
      // Passed through so the client can render the failure instead of an empty
      // list. A page that renders "No automations yet" after a 500 tells the
      // user they have none, which is a different and worse thing than an error.
      initialError={result.error}
    />
  );
}
