import { notFound } from "next/navigation";
import { getInvoice } from "@/actions/invoices";
import { InvoiceDetailClient } from "./invoice-detail-client";
import { InvoiceLoadError } from "./invoice-load-error";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  const result = await getInvoice(id);

  // INV-11: this was `if (error || !invoice) notFound()`. A 404 is the only
  // result that means "no such invoice"; anything else is an outage, and
  // rendering "This page could not be found" for an outage is a definitive
  // claim about the user's data made on the strength of a 500.
  if (result.status === 404) {
    notFound();
  }
  if (result.error || !result.data) {
    return <InvoiceLoadError message={result.error} />;
  }

  return <InvoiceDetailClient invoice={result.data} />;
}
