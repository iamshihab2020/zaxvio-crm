import type { Metadata } from "next";
import { JobsPageClient } from "./jobs-page-client";

export const metadata: Metadata = {
  title: "Jobs",
};

export default function JobsPage() {
  return <JobsPageClient />;
}