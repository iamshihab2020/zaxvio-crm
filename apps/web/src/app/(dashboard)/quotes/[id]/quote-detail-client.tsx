"use client";

import { useState, useCallback } from "react";
import type { QuoteDetail } from "@/components/dashboard/quotes/quote-detail-sheet";
import { getQuote } from "@/actions/quotes";
import { QuoteDetailHeader } from "@/components/dashboard/quotes/quote-detail-header";
import { QuoteInfoPanel } from "@/components/dashboard/quotes/quote-info-panel";
import { QuoteTabsPanel } from "@/components/dashboard/quotes/quote-tabs-panel";
import { QuoteSidebarPanel } from "@/components/dashboard/quotes/quote-sidebar-panel";

interface QuoteDetailClientProps {
  quote: QuoteDetail;
}

export function QuoteDetailClient({
  quote: initialQuote,
}: QuoteDetailClientProps) {
  const [quote, setQuote] = useState<QuoteDetail>(initialQuote);

  const refreshQuote = useCallback(async () => {
    const res = await getQuote(quote.id);
    if (res.data) setQuote(res.data as QuoteDetail);
  }, [quote.id]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <QuoteDetailHeader quote={quote} onUpdate={refreshQuote} />
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:items-start">
          {/* Left Panel */}
          <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <QuoteInfoPanel quote={quote} />
          </div>
          {/* Center Panel */}
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
            <QuoteTabsPanel quote={quote} onUpdate={refreshQuote} />
          </div>
          {/* Right Sidebar */}
          <div className="hidden xl:block w-72 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <QuoteSidebarPanel quote={quote} />
          </div>
        </div>
      </div>
    </div>
  );
}
