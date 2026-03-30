"use client";

import { useState } from "react";
import { IconClock } from "@tabler/icons-react";
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
import { extendTrial } from "@/actions/admin";

const PRESETS = [7, 14, 30, 60];

export function ExtendTrialDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenantId: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (days < 1 || days > 365) {
      setError("Days must be between 1 and 365");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await extendTrial(tenantId, days);
    setLoading(false);
    if (result.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      setError(result.error ?? "Failed to extend trial");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconClock className="h-5 w-5 text-admin-accent" />
            Extend Trial
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-body">
            Extend the trial period for <strong>{tenantName}</strong>.
          </p>
          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                variant={days === preset ? "default" : "outline"}
                size="sm"
                className={days === preset ? "bg-admin-accent hover:bg-admin-accent/90 text-white" : ""}
                onClick={() => setDays(preset)}
              >
                {preset}d
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-days" className="font-body text-sm">
              Custom days
            </Label>
            <Input
              id="custom-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
              className="font-body"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-admin-accent hover:bg-admin-accent/90 text-white"
          >
            {loading ? "Extending..." : `Extend by ${days} days`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
