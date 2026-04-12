"use client";

import { IconClockOff } from "@tabler/icons-react";

interface QuoteExpiredViewProps {
  quoteNumber: string;
  businessName: string;
  businessPhone: string | null;
}

export function QuoteExpiredView({
  quoteNumber,
  businessName,
  businessPhone,
}: QuoteExpiredViewProps) {
  return (
    <div className="text-center space-y-4 py-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <IconClockOff className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold font-heading">Estimate Expired</h2>
        <p className="text-sm text-muted-foreground font-body">
          Estimate {quoteNumber} is no longer valid.
        </p>
      </div>

      <p className="text-sm text-muted-foreground font-body">
        Please contact {businessName}
        {businessPhone ? ` at ${businessPhone}` : ""} to request an updated
        estimate.
      </p>
    </div>
  );
}
