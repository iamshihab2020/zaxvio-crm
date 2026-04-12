import { getPublicQuote } from "@/actions/public-quote";
import { QuoteAcceptanceClient } from "./quote-acceptance-client";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface QuotePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: QuotePageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await getPublicQuote(token);

  if (!result.data) {
    return { title: "Estimate Not Found" };
  }

  const { business, quote } = result.data;
  return {
    title: `Your Estimate from ${business.name} — ${quote.quoteNumber}`,
    description: `Review and respond to your estimate from ${business.name}.`,
  };
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { token } = await params;
  const result = await getPublicQuote(token);

  if (!result.data) {
    notFound();
  }

  return <QuoteAcceptanceClient token={token} initialData={result.data} />;
}
