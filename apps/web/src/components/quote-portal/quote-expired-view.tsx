"use client";

import { IconPhone } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface QuoteExpiredViewProps {
  quoteNumber: string;
  businessName: string;
  businessPhone: string | null;
}

/**
 * An expired estimate is not a dead end.
 *
 * The previous version was a grey clock icon over "Estimate Expired" and
 * "no longer valid" — a state described rather than a next step offered. In
 * practice a contractor will almost always still honour a price a few days
 * past its date; the customer just has to ask. So the page says what to do and
 * makes the phone number the action, rather than burying it in a sentence.
 */
export function QuoteExpiredView({
  quoteNumber,
  businessName,
  businessPhone,
}: QuoteExpiredViewProps) {
  return (
    <div className="space-y-5 py-2">
      <div className="border-b border-ink/15 pb-4 dark:border-border">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {quoteNumber} · Expired
        </p>
        <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">
          This estimate has passed its date
        </h2>
      </div>

      <p className="font-body text-sm leading-relaxed text-foreground">
        Prices can usually still be honoured — {businessName} just needs to
        re-issue it. Get in touch and they&rsquo;ll send an updated estimate.
      </p>

      {businessPhone && (
        <Button
          asChild
          className="cursor-pointer bg-brand font-body text-brand-foreground hover:bg-brand/90"
        >
          <a href={`tel:${businessPhone.replace(/[^\d+]/g, "")}`}>
            <IconPhone className="mr-2 h-4 w-4" aria-hidden />
            Call {businessPhone}
          </a>
        </Button>
      )}
    </div>
  );
}
