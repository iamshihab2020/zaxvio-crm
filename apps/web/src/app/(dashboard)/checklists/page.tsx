import type { Metadata } from "next";
import { ChecklistsPageClient } from "./checklists-page-client";

export const metadata: Metadata = {
  title: "Checklists",
  description: "Manage checklist templates for job types",
};

export default function ChecklistsPage() {
  return <ChecklistsPageClient />;
}
