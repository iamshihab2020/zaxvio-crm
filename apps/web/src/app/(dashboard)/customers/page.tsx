import type { Metadata } from "next";
import { getCustomers, getCustomerStats } from "@/actions/customers";
import { CustomersPageClient } from "./customers-page-client";

export const metadata: Metadata = {
  title: "Customers",
  description: "Manage your customers",
};

export default async function CustomersPage() {
  const [result, statsResult] = await Promise.all([
    getCustomers({ page: 1, limit: 15 }),
    getCustomerStats(),
  ]);

  return (
    <CustomersPageClient
      initialCustomers={(result.data ?? []) as never[]}
      initialPagination={result.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 }}
      initialStats={statsResult.data ?? undefined}
    />
  );
}
