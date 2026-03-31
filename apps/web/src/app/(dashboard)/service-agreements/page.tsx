import type { Metadata } from "next";
import { ServiceAgreementsPageClient } from "./service-agreements-page-client";

export const metadata: Metadata = {
  title: "Service Agreements",
  description: "Manage service agreements and maintenance contracts",
};

export default function ServiceAgreementsPage() {
  return <ServiceAgreementsPageClient />;
}
