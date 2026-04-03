"use client";

import { useState } from "react";
import { IconCurrencyDollar } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { overrideSubscription } from "@/actions/admin";

const STATUS_OPTIONS = [
  { value: "trialing", label: "Trialing" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "past_due", label: "Past Due" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter ($49/mo)" },
  { value: "pro", label: "Pro ($99/mo)" },
  { value: "enterprise", label: "Enterprise ($199/mo)" },
];

export function OverrideSubscriptionDialog({
  tenantId,
  tenantName,
  currentStatus,
  currentPlan,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenantId: string;
  tenantName: string;
  currentStatus: string | null;
  currentPlan: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(currentStatus ?? "active");
  const [planName, setPlanName] = useState(currentPlan ?? "starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    const result = await overrideSubscription(tenantId, { status, planName });
    setLoading(false);
    if (result.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      setError(result.error ?? "Failed to override subscription");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5 text-admin-accent" />
            Override Subscription
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-body">
            Override subscription for <strong>{tenantName}</strong>.
          </p>

          <div className="space-y-2">
            <Label className="font-body text-sm">Status</Label>
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between font-body">
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-1" align="start">
                {STATUS_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatus(option.value);
                      setStatusOpen(false);
                    }}
                    className="w-full justify-start font-body"
                  >
                    {option.label}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">Plan</Label>
            <Popover open={planOpen} onOpenChange={setPlanOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between font-body">
                  {PLAN_OPTIONS.find((o) => o.value === planName)?.label ?? planName}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-1" align="start">
                {PLAN_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPlanName(option.value);
                      setPlanOpen(false);
                    }}
                    className="w-full justify-start font-body"
                  >
                    {option.label}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
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
            {loading ? "Saving..." : "Override Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
