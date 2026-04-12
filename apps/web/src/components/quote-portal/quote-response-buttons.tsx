"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconCheck, IconX, IconChevronLeft } from "@tabler/icons-react";

interface QuoteResponseButtonsProps {
  onAccept: () => void;
  onDecline: (reason?: string) => void;
  accepting: boolean;
  declining: boolean;
}

export function QuoteResponseButtons({
  onAccept,
  onDecline,
  accepting,
  declining,
}: QuoteResponseButtonsProps) {
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const loading = accepting || declining;

  if (showDeclineForm) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium font-body">
            Would you like to share why? (optional)
          </p>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="e.g., price too high, found another provider, project postponed..."
            rows={3}
            className="font-body text-sm"
            maxLength={2000}
          />
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowDeclineForm(false)}
            disabled={declining}
            className="cursor-pointer"
          >
            <IconChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={() => onDecline(declineReason || undefined)}
            disabled={declining}
            className="flex-1 cursor-pointer"
          >
            {declining ? "Declining..." : "Confirm Decline"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-body text-center">
        How would you like to respond to this estimate?
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setShowDeclineForm(true)}
          disabled={loading}
          className="flex-1 cursor-pointer"
        >
          <IconX className="mr-2 h-4 w-4" />
          Decline
        </Button>
        <Button
          onClick={onAccept}
          disabled={loading}
          className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
        >
          {accepting ? (
            "Accepting..."
          ) : (
            <>
              <IconCheck className="mr-2 h-4 w-4" />
              Accept Estimate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
