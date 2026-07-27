import type { Metadata } from "next";
import type { Customer } from "@hvac-saas/types";
import { getCustomers, getCustomerStats } from "@/actions/customers";
import { CustomersPageClient } from "./customers-page-client";

export const metadata: Metadata = {
  title: "Customers",
  description: "Manage your customers",
};

export default async function CustomersPage() {
  const [result, statsResult] = await Promise.all([
    getCustomers({ page: 1, limit: 15, sortBy: "createdAt", sortOrder: "desc" }),
    getCustomerStats(),
  ]);

  // These are seeded into the query cache by the client (CUST-13). They used to
  // be fetched here, passed down, and never read — two round trips per navigation
  // whose results were discarded while the user watched a skeleton.
  return (
    <CustomersPageClient
      initialCustomers={(result.data ?? []) as Customer[]}
      initialPagination={result.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 }}
      initialStats={statsResult.data ?? undefined}
    />
  );
}
