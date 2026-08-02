"use client";

import { IconCircleCheck, IconCalendarEvent } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface QuoteConfirmationProps {
  status: "accepted" | "declined";
  businessName: string;
  quoteNumber: string;
  jobCreated?: boolean;
  bookingUrl?: string;
}

/**
 * The receipt for a decision the customer just made.
 *
 * Kept quiet on purpose — the boldness on this page is spent on the total in
 * the document, and a second loud moment here would compete with it. Declining
 * gets no icon and no sad styling: someone who says no has done nothing wrong
 * and does not need a red circle about it.
 */
export function QuoteConfirmation({
  status,
  businessName,
  quoteNumber,
  jobCreated,
  bookingUrl,
}: QuoteConfirmationProps) {
  const isAccepted = status === "accepted";

  return (
    <div className="space-y-5 py-2">
      <div className="border-b border-ink/15 pb-4 dark:border-border">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
          {quoteNumber} · {isAccepted ? "Accepted" : "Declined"}
        </p>
        <h2 className="mt-2 flex items-center gap-2 font-heading text-xl font-semibold text-foreground">
          {isAccepted && (
            <IconCircleCheck className="h-5 w-5 text-brand" aria-hidden />
          )}
          {isAccepted ? "You’re all set" : "Thanks for letting us know"}
        </h2>
      </div>

      <p className="font-body text-sm leading-relaxed text-foreground">
        {isAccepted
          ? `${businessName} has been notified and will be in touch to arrange the work.`
          : `${businessName} has been notified. If anything changes, get in touch — they can send a revised estimate.`}
      </p>

      {isAccepted && jobCreated && (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Appointment created
        </p>
      )}

      {isAccepted && bookingUrl && (
        <div className="border-t border-ink/10 pt-5 dark:border-border">
          <p className="font-body text-sm text-foreground">
            Want to pick a time now?
          </p>
          <Button
            asChild
            className="mt-3 cursor-pointer bg-brand font-body text-brand-foreground hover:bg-brand/90"
          >
            <a href={bookingUrl}>
              <IconCalendarEvent className="mr-2 h-4 w-4" aria-hidden />
              Choose an appointment
            </a>
          </Button>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            Or skip it — someone will call to schedule.
          </p>
        </div>
      )}
    </div>
  );
}
