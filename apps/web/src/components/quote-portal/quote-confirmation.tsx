"use client";

import { IconCircleCheck, IconCircleX, IconCalendarEvent } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface QuoteConfirmationProps {
  status: "accepted" | "declined";
  businessName: string;
  quoteNumber: string;
  jobCreated?: boolean;
  bookingUrl?: string;
}

export function QuoteConfirmation({
  status,
  businessName,
  quoteNumber,
  jobCreated,
  bookingUrl,
}: QuoteConfirmationProps) {
  const isAccepted = status === "accepted";

  return (
    <div className="text-center space-y-4 py-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {isAccepted ? (
          <IconCircleCheck className="h-10 w-10 text-green-500" />
        ) : (
          <IconCircleX className="h-10 w-10 text-muted-foreground" />
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold font-heading">
          {isAccepted ? "Estimate Accepted" : "Estimate Declined"}
        </h2>
        <p className="text-sm text-muted-foreground font-body">
          {isAccepted
            ? `Thank you! ${businessName} has been notified and will be in touch shortly.`
            : `You've declined estimate ${quoteNumber}. ${businessName} has been notified.`}
        </p>
      </div>

      {isAccepted && jobCreated && (
        <p className="text-xs text-muted-foreground font-body">
          A service appointment has been created automatically.
        </p>
      )}

      {isAccepted && bookingUrl && (
        <div className="space-y-3 pt-2">
          <div className="mx-auto max-w-xs rounded-lg border border-border bg-muted/50 p-5">
            <div className="flex items-center justify-center gap-2 text-sm font-medium font-body mb-3">
              <IconCalendarEvent className="h-4 w-4 text-brand" />
              <span>Ready to schedule?</span>
            </div>
            <Button
              asChild
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              <a href={bookingUrl}>Book an Appointment</a>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground font-body">
              No worries if you skip this — someone from the team will contact you to schedule.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
