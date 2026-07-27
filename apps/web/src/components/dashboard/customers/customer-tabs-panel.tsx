"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CustomerOverviewTab } from "./customer-overview-tab";
import { CustomerActivityTab } from "./customer-activity-tab";
import { CustomerNotesTab } from "./customer-notes-tab";
import { CustomerJobsTab } from "./customer-jobs-tab";
import { CustomerInvoicesTab } from "./customer-invoices-tab";
import { CustomerEquipmentTab } from "./customer-equipment-tab";
import { CustomerQuotesTab } from "./customer-quotes-tab";
import { CustomerAgreementsTab } from "./customer-agreements-tab";
import { CustomerPhotosTab } from "./customer-photos-tab";
import { CustomerConversationsTab } from "./customer-conversations-tab";

interface CustomerTabsPanelProps {
  customerId: string;
}

const TABS = [
  "overview",
  "jobs",
  "invoices",
  "quotes",
  "equipment",
  "agreements",
  "photos",
  "conversations",
  "activity",
  "notes",
] as const;

export function CustomerTabsPanel({ customerId }: CustomerTabsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab selection lives in the URL, so refreshing, going back, or sending
  // someone a link to a customer's invoices all work. It was local state with a
  // `defaultValue`, which meant every one of those landed on Overview (CUST-32).
  const requested = searchParams.get("tab");
  const active = TABS.includes(requested as (typeof TABS)[number]) ? requested! : "overview";

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "overview") params.delete("tab");
      else params.set("tab", value);
      const qs = params.toString();
      // `scroll: false` — switching tabs should not jump the page to the top.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <Tabs value={active} onValueChange={handleChange} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto lg:-mx-5 lg:px-5 lg:rounded-none">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="quotes">Quotes</TabsTrigger>
        <TabsTrigger value="equipment">Assets</TabsTrigger>
        <TabsTrigger value="agreements">Agreements</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="conversations">Messages</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 sm:mt-5">
        <CustomerOverviewTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="jobs" className="mt-4 sm:mt-5">
        <CustomerJobsTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="invoices" className="mt-4 sm:mt-5">
        <CustomerInvoicesTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="quotes" className="mt-4 sm:mt-5">
        <CustomerQuotesTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="equipment" className="mt-4 sm:mt-5">
        <CustomerEquipmentTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="agreements" className="mt-4 sm:mt-5">
        <CustomerAgreementsTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="photos" className="mt-4 sm:mt-5">
        <CustomerPhotosTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="conversations" className="mt-4 sm:mt-5">
        <CustomerConversationsTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="activity" className="mt-4 sm:mt-5">
        <CustomerActivityTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="notes" className="mt-4 sm:mt-5">
        <CustomerNotesTab customerId={customerId} />
      </TabsContent>
    </Tabs>
  );
}
