"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobDetailLineItems } from "./job-detail-line-items";
import { JobDetailChecklist } from "./job-detail-checklist";
import { JobDetailPhotos } from "./job-detail-photos";
import { JobDetailDocuments } from "./job-detail-documents";
import { JobDetailActivities } from "./job-detail-activities";
import type { JobDetail } from "./job-detail-sheet";

interface JobTabsPanelProps {
  job: JobDetail;
  onUpdate: () => void;
}

export function JobTabsPanel({ job, onUpdate }: JobTabsPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("line-items");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-0 -mt-1">
        <TabsTrigger
          value="line-items"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Line Items ({job.lineItems.length})
        </TabsTrigger>
        <TabsTrigger
          value="checklist"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Checklist ({job.checklist.length})
        </TabsTrigger>
        <TabsTrigger
          value="files"
          className="cursor-pointer data-[state=active]:border-b-2 data-[state=active]:border-brand rounded-none"
        >
          Files ({job.photoCount})
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
          <JobDetailLineItems
            jobId={job.id}
            lineItems={job.lineItems}
            onUpdate={onUpdate}
          />
        </TabsContent>
        <TabsContent value="checklist" className="mt-0">
          <JobDetailChecklist
            jobId={job.id}
            checklist={job.checklist}
            onUpdate={onUpdate}
          />
        </TabsContent>
        <TabsContent value="files" className="mt-0">
          <div className="space-y-6">
            <JobDetailPhotos jobId={job.id} customerId={job.customerId} />
            <div className="border-t border-border pt-4">
              <JobDetailDocuments jobId={job.id} customerId={job.customerId} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <JobDetailActivities jobId={job.id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
