import { notFound } from "next/navigation";
import { getInvoice } from "@/actions/invoices";
import { InvoiceDetailClient } from "./invoice-detail-client";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  const { data: invoice, error } = await getInvoice(id);

  if (error || !invoice) {
    notFound();
  }

  return <InvoiceDetailClient invoice={invoice} />;
}
