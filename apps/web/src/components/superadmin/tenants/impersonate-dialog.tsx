"use client";

import { useState } from "react";
import { IconEye } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ImpersonateDialog({
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
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Reason is required for impersonation");
      return;
    }
    setLoading(true);
    setError(null);

    // TODO: Call impersonation API endpoint when implemented
    // For now, show a message that impersonation is not yet available
    setError("Impersonation flow requires Better Auth admin plugin integration (coming soon)");
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconEye className="h-5 w-5 text-admin-accent" />
            Impersonate Tenant
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-body text-amber-800 dark:text-amber-200">
              You will view the dashboard as <strong>{tenantName}</strong>. All
              actions will be logged to the audit trail.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason" className="font-body text-sm">
              Reason for impersonation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer support ticket #123 — user can't see their invoices"
              className="font-body min-h-[80px]"
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
            disabled={loading || !reason.trim()}
            className="bg-admin-accent hover:bg-admin-accent/90 text-white"
          >
            {loading ? "Starting..." : "Start Impersonation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
