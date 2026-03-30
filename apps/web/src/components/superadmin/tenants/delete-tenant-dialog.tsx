"use client";

import { useState } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
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
import { deleteTenant } from "@/actions/admin";

export function DeleteTenantDialog({
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
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMatch = confirmName === tenantName;

  const handleSubmit = async () => {
    if (!isMatch) return;
    setLoading(true);
    setError(null);
    const result = await deleteTenant(tenantId, confirmName);
    setLoading(false);
    if (result.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      setError(result.error ?? "Failed to delete tenant");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="h-5 w-5" />
            Delete Tenant
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-body text-destructive">
              This action is <strong>irreversible</strong>. All tenant data
              (customers, jobs, invoices, quotes) will be permanently deleted.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-name" className="font-body text-sm">
              Type <strong>{tenantName}</strong> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={tenantName}
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isMatch || loading}
          >
            {loading ? "Deleting..." : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
