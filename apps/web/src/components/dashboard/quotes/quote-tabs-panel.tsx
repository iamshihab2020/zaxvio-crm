"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteLineItemsTab } from "./quote-line-items-tab";
import { IconActivity } from "@tabler/icons-react";
import type { QuoteDetail } from "./quote-detail-sheet";

interface QuoteTabsPanelProps {
  quote: QuoteDetail;
  onUpdate: () => void;
}

export function QuoteTabsPanel({ quote, onUpdate }: QuoteTabsPanelProps) {
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
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
              <IconActivity className="h-5 w-5 text-brand" />
            </div>
            <p className="text-sm font-medium text-foreground font-body">
              Activity timeline
            </p>
            <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}
