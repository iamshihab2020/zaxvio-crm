import { getAdminTenants } from "@/actions/admin";
import { TenantsPageClient } from "./tenants-page-client";

export default async function SuperAdminTenantsPage() {
  const result = await getAdminTenants({ page: 1, limit: 20 });

  return (
    <TenantsPageClient
      initialData={result.data ?? []}
      initialPagination={result.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 }}
    />
  );
}
