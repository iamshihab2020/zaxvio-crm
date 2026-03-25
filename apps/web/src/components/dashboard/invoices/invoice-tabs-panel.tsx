"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceLineItemsTab } from "./invoice-line-items-tab";
import { InvoicePaymentsTab } from "./invoice-payments-tab";
import { IconActivity } from "@tabler/icons-react";
import type { InvoiceDetail } from "./invoice-detail-sheet";

interface InvoiceTabsPanelProps {
  invoice: InvoiceDetail;
  onUpdate: () => void;
}

export function InvoiceTabsPanel({ invoice, onUpdate }: InvoiceTabsPanelProps) {
  const [activeTab, setActiveTab] = useState("line-items");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-0 -mt-1">
        <TabsTrigger
          value="line-items"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Line Items ({invoice.lineItems.length})
        </TabsTrigger>
        <TabsTrigger
          value="payments"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Payments ({invoice.payments.length})
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
          <InvoiceLineItemsTab
            invoiceId={invoice.id}
            lineItems={invoice.lineItems}
            isDraft={invoice.status === "draft"}
            onUpdate={onUpdate}
          />
        </TabsContent>
        <TabsContent value="payments" className="mt-0">
          <InvoicePaymentsTab
            invoiceId={invoice.id}
            payments={invoice.payments}
            balanceDue={invoice.balanceDue}
            isVoid={invoice.status === "void"}
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
