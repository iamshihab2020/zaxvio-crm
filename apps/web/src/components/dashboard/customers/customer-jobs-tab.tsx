"use client";

import { IconBriefcase } from "@tabler/icons-react";

export function CustomerJobsTab() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
        <IconBriefcase className="h-5 w-5 text-brand" />
      </div>
      <p className="text-sm font-medium text-foreground font-body">
        No jobs yet
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Jobs for this customer will appear here
      </p>
    </div>
  );
}
