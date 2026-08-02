"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { QuoteDetail } from "@/components/dashboard/quotes/quote-detail-sheet";
import { useQuote } from "@/hooks/queries";
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
  const [refreshKey, setRefreshKey] = useState(0);

  // QUO-15: reads through TanStack Query so mutations made here invalidate the
  // list, the stats and the dashboard. Seeded from the server render, so there
  // is no second fetch on arrival.
  const quoteQuery = useQuote(initialQuote.id, {
    data: initialQuote,
    error: null,
  });
  const quote = (quoteQuery.data?.data ?? initialQuote) as QuoteDetail;

  // QUO-16: these were two effects racing on the same value. On mount with a
  // stored preference of "sheet", the first set it to "page" while the second
  // read the still-stale "sheet" and pushed straight back to /quotes — so any
  // deep link into a quote bounced to the list. Landing on this route *is* the
  // preference; only a later, deliberate change should navigate. Same fix as
  // JOB-38, which has carried this ref since 2026-07-29.
  const adoptedPageMode = useRef(false);
  useEffect(() => {
    if (!viewMounted || adoptedPageMode.current) return;
    adoptedPageMode.current = true;
    if (viewMode !== "page") setViewMode("page");
  }, [viewMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewMounted || !adoptedPageMode.current) return;
    if (viewMode === "page") return;
    router.push(`/quotes?quoteId=${quote.id}`);
  }, [viewMode, viewMounted, router, quote.id]);

  const refreshQuote = useCallback(async () => {
    await quoteQuery.refetch();
    setRefreshKey((k) => k + 1);
  }, [quoteQuery]);

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
