"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CustomerActivityTab } from "./customer-activity-tab";
import { CustomerNotesTab } from "./customer-notes-tab";
import { CustomerJobsTab } from "./customer-jobs-tab";
import { CustomerInvoicesTab } from "./customer-invoices-tab";
import { CustomerEquipmentTab } from "./customer-equipment-tab";

interface CustomerTabsPanelProps {
  customerId: string;
  activityKey?: number;
}

export function CustomerTabsPanel({ customerId, activityKey }: CustomerTabsPanelProps) {
  return (
    <Tabs defaultValue="activity" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto lg:-mx-5 lg:px-5 lg:rounded-none">
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="equipment">Equipment</TabsTrigger>
      </TabsList>

      <TabsContent value="activity" className="mt-4 sm:mt-5">
        <CustomerActivityTab customerId={customerId} refreshKey={activityKey} />
      </TabsContent>
      <TabsContent value="notes" className="mt-4 sm:mt-5">
        <CustomerNotesTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="jobs" className="mt-4 sm:mt-5">
        <CustomerJobsTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="invoices" className="mt-4 sm:mt-5">
        <CustomerInvoicesTab customerId={customerId} />
      </TabsContent>
      <TabsContent value="equipment" className="mt-4 sm:mt-5">
        <CustomerEquipmentTab />
      </TabsContent>
    </Tabs>
  );
}
