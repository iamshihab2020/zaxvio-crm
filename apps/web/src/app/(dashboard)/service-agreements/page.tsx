import type { Metadata } from "next";
import { getMaintenanceContracts } from "@/actions/maintenance-contracts";
import { ServiceAgreementsPageClient } from "./service-agreements-page-client";

export const metadata: Metadata = {
  title: "Service Agreements",
  description: "Manage service agreements and maintenance contracts",
};

export default async function ServiceAgreementsPage() {
  const result = await getMaintenanceContracts({ page: 1, limit: 15 });

  return (
    <ServiceAgreementsPageClient
      initialAgreements={(result.data ?? []) as never[]}
      initialPagination={result.pagination as never}
    />
  );
}
