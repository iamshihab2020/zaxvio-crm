import type { Metadata } from "next";
import { getChecklistTemplates } from "@/actions/checklists";
import { ChecklistsPageClient } from "./checklists-page-client";

export const metadata: Metadata = {
  title: "Checklists",
  description: "Manage checklist templates for job types",
};

export default async function ChecklistsPage() {
  const result = await getChecklistTemplates({});

  return (
    <ChecklistsPageClient
      initialTemplates={(result.data ?? []) as never[]}
    />
  );
}
