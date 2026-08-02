"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCheck, IconX, IconChevronLeft, IconCalendar } from "@tabler/icons-react";

interface QuoteResponseButtonsProps {
  onAccept: (schedule?: { scheduledDate?: string; scheduledTime?: string }) => void;
  onDecline: (reason?: string) => void;
  accepting: boolean;
  declining: boolean;
  /**
   * Tenant setting. When on, the customer is asked for a preferred date as part
   * of accepting.
   *
   * QUO-26: the column pair, the API body, the activity metadata, the
   * notification text and the job-conversion preference all existed and the
   * portal never sent one — `onAccept={() => handleAccept()}` discarded
   * everything. The feature was built end to end on the server and unreachable.
   */
  schedulingEnabled?: boolean;
  /** Today in the business's timezone — the earliest selectable date. */
  minDate?: string;
}

export function QuoteResponseButtons({
  onAccept,
  onDecline,
  accepting,
  declining,
  schedulingEnabled = false,
  minDate,
}: QuoteResponseButtonsProps) {
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const loading = accepting || declining;

  function handleAcceptClick() {
    if (schedulingEnabled && !showScheduleForm) {
      setShowScheduleForm(true);
      return;
    }
    onAccept(
      scheduledDate
        ? {
            scheduledDate,
            scheduledTime: scheduledTime || undefined,
          }
        : undefined,
    );
  }

  if (showScheduleForm) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Preferred timing
          </p>
          <p className="font-body text-sm text-foreground">
            Optional — we&rsquo;ll confirm the final time with you.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="preferred-date" className="text-xs font-body">
              Preferred date
            </Label>
            <Input
              id="preferred-date"
              type="date"
              value={scheduledDate}
              min={minDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="font-body"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferred-time" className="text-xs font-body">
              Preferred time
            </Label>
            <Input
              id="preferred-time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="font-body"
              disabled={!scheduledDate}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowScheduleForm(false)}
            disabled={accepting}
            className="cursor-pointer"
          >
            <IconChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleAcceptClick}
            disabled={accepting}
            className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
          >
            {accepting ? (
              "Accepting..."
            ) : (
              <>
                <IconCheck className="mr-2 h-4 w-4" />
                {scheduledDate ? "Accept and request this date" : "Accept estimate"}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (showDeclineForm) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Reason (optional)
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
            {declining ? "Declining..." : "Decline estimate"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

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
          onClick={handleAcceptClick}
          disabled={loading}
          className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
        >
          {accepting ? (
            "Accepting..."
          ) : (
            <>
              {schedulingEnabled ? (
                <IconCalendar className="mr-2 h-4 w-4" />
              ) : (
                <IconCheck className="mr-2 h-4 w-4" />
              )}
              Accept estimate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
