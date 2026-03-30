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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAdminTier } from "@/actions/admin";

const TIER_OPTIONS = [
  { value: "super_admin", label: "Super Admin", description: "Full platform control" },
  { value: "support", label: "Support", description: "Tenant support & audit access" },
  { value: "billing_admin", label: "Billing Admin", description: "Subscription management" },
] as const;

export function EditAdminTierDialog({
  adminId,
  adminName,
  currentTier,
  open,
  onOpenChange,
  onSuccess,
  isOwner,
}: {
  adminId: string;
  adminName: string;
  currentTier: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isOwner: boolean;
}) {
  const [tier, setTier] = useState(currentTier);
  const [makeOwner, setMakeOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanged = tier !== currentTier || makeOwner;

  const handleSubmit = async () => {
    if (!hasChanged) return;
    setLoading(true);
    setError(null);

    const result = await updateAdminTier(adminId, makeOwner ? "super_admin" : tier, makeOwner || undefined);
    setLoading(false);

    if (result.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      setError(result.error ?? "Failed to update tier");
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setError(null);
      setTier(currentTier);
      setMakeOwner(false);
    }
    onOpenChange(value);
  };

  const availableTiers = isOwner
    ? TIER_OPTIONS
    : TIER_OPTIONS.filter((t) => t.value !== "super_admin");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Edit Admin Tier — {adminName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-tier" className="font-body text-sm">
              Admin Tier
            </Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTiers.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="font-body">
                    {option.label} — {option.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isOwner && (
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={makeOwner}
                onChange={(e) => setMakeOwner(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
              />
              <div>
                <p className="text-sm font-medium font-body">
                  Promote to Owner
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  Owners cannot be removed by other admins. This is irreversible
                  via the UI. Use for co-founders or business partners.
                </p>
              </div>
            </label>
          )}
          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={handleSubmit}
            disabled={!hasChanged || loading}
          >
            {loading ? "Updating..." : "Update Tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
