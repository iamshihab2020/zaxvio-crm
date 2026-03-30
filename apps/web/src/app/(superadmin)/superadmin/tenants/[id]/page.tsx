import { getAdminTenant } from "@/actions/admin";
import { TenantDetailClient } from "./tenant-detail-client";
import { notFound } from "next/navigation";

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getAdminTenant(params.id);

  if (!result.data) {
    notFound();
  }

  return <TenantDetailClient tenant={result.data} />;
}
