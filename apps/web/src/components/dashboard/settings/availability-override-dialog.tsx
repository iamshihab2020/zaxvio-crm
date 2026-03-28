"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface AvailabilityOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    overrideDate: string;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) => void;
  saving: boolean;
}

export function AvailabilityOverrideDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: AvailabilityOverrideDialogProps) {
  const [overrideDate, setOverrideDate] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");

  const handleSave = () => {
    onSave({
      overrideDate,
      isAvailable,
      ...(isAvailable ? { startTime, endTime } : {}),
      reason: reason.trim() || undefined,
    });
    // Reset form
    setOverrideDate("");
    setIsAvailable(false);
    setStartTime("08:00");
    setEndTime("17:00");
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Add Schedule Override</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
            <Label className="text-sm">
              {isAvailable ? "Open with custom hours" : "Closed / Unavailable"}
            </Label>
          </div>

          {isAvailable && (
            <div className="flex items-center gap-2">
              <div className="space-y-2 flex-1">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Holiday, Vacation"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !overrideDate}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {saving ? "Saving..." : "Add Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
