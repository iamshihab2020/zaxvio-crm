"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { QuoteDetail } from "@/components/dashboard/quotes/quote-detail-sheet";
import { getQuote } from "@/actions/quotes";
import { QuoteDetailHeader } from "@/components/dashboard/quotes/quote-detail-header";
import { QuoteInfoPanel } from "@/components/dashboard/quotes/quote-info-panel";
import { QuoteTabsPanel } from "@/components/dashboard/quotes/quote-tabs-panel";
import { QuoteSidebarPanel } from "@/components/dashboard/quotes/quote-sidebar-panel";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";

interface QuoteDetailClientProps {
  quote: QuoteDetail;
}

export function QuoteDetailClient({
  quote: initialQuote,
}: QuoteDetailClientProps) {
  const router = useRouter();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("quotes");
  const [quote, setQuote] = useState<QuoteDetail>(initialQuote);
  const [refreshKey, setRefreshKey] = useState(0);

  // Set preference to "page" since user is on the full page view
  useEffect(() => {
    if (viewMounted && viewMode !== "page") {
      setViewMode("page");
    }
  }, [viewMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user switches away from "page" mode, navigate back to list with deep-link
  useEffect(() => {
    if (viewMounted && viewMode !== "page") {
      router.push(`/quotes?quoteId=${quote.id}`);
    }
  }, [viewMode, viewMounted, router, quote.id]);

  const refreshQuote = useCallback(async () => {
    const res = await getQuote(quote.id);
    if (res.data) setQuote(res.data as QuoteDetail);
    setRefreshKey((k) => k + 1);
  }, [quote.id]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <QuoteDetailHeader quote={quote} onUpdate={refreshQuote}>
        {viewMounted && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </QuoteDetailHeader>
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:items-start">
          {/* Left Panel */}
          <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <QuoteInfoPanel quote={quote} />
          </div>
          {/* Center Panel */}
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
            <QuoteTabsPanel quote={quote} onUpdate={refreshQuote} refreshKey={refreshKey} />
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
