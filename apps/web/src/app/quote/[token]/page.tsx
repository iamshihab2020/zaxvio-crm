import { cache } from "react";
import { getPublicQuote } from "@/actions/public-quote";
import { QuoteAcceptanceClient } from "./quote-acceptance-client";
import { QuotePortalError } from "@/components/quote-portal/quote-portal-error";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface QuotePageProps {
  params: Promise<{ token: string }>;
}

/**
 * QUO-34: `generateMetadata` and the page component each called this, so every
 * public page view cost two API round trips. `cache` dedupes them within one
 * render pass.
 */
const loadQuote = cache(async (token: string) => getPublicQuote(token));

export async function generateMetadata({ params }: QuotePageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await loadQuote(token);

  // QUO-31: the root layout sets `robots: { index: true, follow: true }` and
  // nothing here overrode it, so a page carrying a customer's name, address,
  // phone and itemised pricing was explicitly inviting crawlers. A tokenised
  // private document should never be indexable.
  const robots = { index: false, follow: false } as const;

  if (!result.data) {
    return { title: "Estimate", robots };
  }

  const { business, quote } = result.data;
  return {
    title: `Your Estimate from ${business.name} — ${quote.quoteNumber}`,
    description: `Review and respond to your estimate from ${business.name}.`,
    robots,
  };
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { token } = await params;
  const result = await loadQuote(token);

  if (!result.data) {
    // QUO-07: this used to be `notFound()` for every failure. `getPublicQuote`
    // returns `{data: null}` for a 404, a 500 *and* a caught network error, so
    // when the API was down a customer holding a valid link was told their
    // estimate does not exist — which reads as withdrawn. Only a genuine
    // "not found" gets the 404 page; anything else says the truth and offers a
    // retry.
    if (result.notFound) notFound();
    return <QuotePortalError message={result.error} />;
  }

  return <QuoteAcceptanceClient token={token} initialData={result.data} />;
}
