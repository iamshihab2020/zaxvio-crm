import { notFound } from "next/navigation";
import { getCustomer } from "@/actions/customers";
import { getTenant } from "@/actions/tenants";
import { CustomerDetailClient } from "./customer-detail-client";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const [{ data: customer, error }, tenantResult] = await Promise.all([
    getCustomer(id),
    getTenant(),
  ]);

  if (error || !customer) {
    notFound();
  }

  return (
    <CustomerDetailClient
      customer={customer}
      defaultTaxRate={(tenantResult.data?.defaultTaxRate as string) ?? "0"}
    />
  );
}
