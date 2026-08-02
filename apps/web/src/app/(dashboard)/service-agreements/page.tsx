import type { Metadata } from "next";
import { getMaintenanceContracts } from "@/actions/maintenance-contracts";
import { ServiceAgreementsPageClient } from "./service-agreements-page-client";
import type { AgreementRow } from "@/components/dashboard/service-agreements/service-agreement-table";
import type { PaginationData } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Service Agreements",
  description: "Manage service agreements and maintenance contracts",
};

export default async function ServiceAgreementsPage() {
  const result = await getMaintenanceContracts({ page: 1, limit: 15 });

  return (
    <ServiceAgreementsPageClient
      initialAgreements={(result.data ?? []) as AgreementRow[]}
      initialPagination={result.pagination as PaginationData | undefined}
    />
  );
}
