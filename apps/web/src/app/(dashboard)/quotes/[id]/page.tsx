import { notFound } from "next/navigation";
import { getQuote } from "@/actions/quotes";
import { QuoteDetailClient } from "./quote-detail-client";

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteDetailPage({
  params,
}: QuoteDetailPageProps) {
  const { id } = await params;
  const { data: quote, error } = await getQuote(id);

  if (error || !quote) {
    notFound();
  }

  return <QuoteDetailClient quote={quote} />;
}
