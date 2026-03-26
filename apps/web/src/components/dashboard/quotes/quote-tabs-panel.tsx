"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteLineItemsTab } from "./quote-line-items-tab";
import { QuoteActivityTab } from "./quote-activity-tab";
import type { QuoteDetail } from "./quote-detail-sheet";

interface QuoteTabsPanelProps {
  quote: QuoteDetail;
  onUpdate: () => void;
  refreshKey?: number;
}

export function QuoteTabsPanel({ quote, onUpdate, refreshKey }: QuoteTabsPanelProps) {
  const [activeTab, setActiveTab] = useState("line-items");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-0 -mt-1">
        <TabsTrigger
          value="line-items"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Line Items ({quote.lineItems.length})
        </TabsTrigger>
        <TabsTrigger
          value="activity"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Activity
        </TabsTrigger>
      </TabsList>

      <div className="pt-4">
        <TabsContent value="line-items" className="mt-0">
          <QuoteLineItemsTab
            quoteId={quote.id}
            lineItems={quote.lineItems}
            isDraft={quote.status === "draft"}
            onUpdate={onUpdate}
          />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <QuoteActivityTab quoteId={quote.id} refreshKey={refreshKey} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
