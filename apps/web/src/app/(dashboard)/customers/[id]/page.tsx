import { notFound } from "next/navigation";
import { getCustomer } from "@/actions/customers";
import { CustomerDetailClient } from "./customer-detail-client";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const { data: customer, error } = await getCustomer(id);

  if (error || !customer) {
    notFound();
  }

  return <CustomerDetailClient customer={customer} />;
}
