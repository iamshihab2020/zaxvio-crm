"use client";

import { Button } from "@/components/ui/button";
import {
  IconCalendarEvent,
  IconAirConditioning,
  IconPlus,
} from "@tabler/icons-react";

export function CustomerSidebarPanel() {
  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Appointments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
            Appointments
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
            <IconPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
            <IconCalendarEvent className="h-5 w-5 text-brand" />
          </div>
          <p className="text-sm font-medium text-foreground font-body">No upcoming appointments</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upcoming appointments will show here
          </p>
        </div>
      </div>

      {/* Equipment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
            Equipment
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
            <IconPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
            <IconAirConditioning className="h-5 w-5 text-brand" />
          </div>
          <p className="text-sm font-medium text-foreground font-body">No equipment on file</p>
          <p className="text-xs text-muted-foreground mt-1">
            Registered equipment will show here
          </p>
        </div>
      </div>
    </div>
  );
}
