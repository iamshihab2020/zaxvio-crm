import type { Metadata } from "next";
import { getCustomers } from "@/actions/customers";
import { CustomersPageClient } from "./customers-page-client";

export const metadata: Metadata = {
  title: "Customers",
  description: "Manage your customers",
};

export default async function CustomersPage() {
  const result = await getCustomers({ page: 1, limit: 15 });

  return (
    <CustomersPageClient
      initialCustomers={(result.data ?? []) as never[]}
      initialPagination={result.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 }}
    />
  );
}
