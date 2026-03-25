import type { Metadata } from "next";
import { InvoicesPageClient } from "./invoices-page-client";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Manage invoices and track payments",
};

export default function InvoicesPage() {
  return <InvoicesPageClient />;
}
