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
import { removeAdminAccess } from "@/actions/admin";

export function RemoveAdminDialog({
  adminId,
  adminName,
  adminEmail,
  open,
  onOpenChange,
  onSuccess,
}: {
  adminId: string;
  adminName: string;
  adminEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMatch = confirmEmail === adminEmail;

  const handleSubmit = async () => {
    if (!isMatch) return;
    setLoading(true);
    setError(null);

    const result = await removeAdminAccess(adminId);
    setLoading(false);

    if (result.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      setError(result.error ?? "Failed to remove admin");
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setError(null);
      setConfirmEmail("");
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="h-5 w-5" />
            Remove Admin Access
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-body text-destructive">
              This will revoke all admin privileges for{" "}
              <strong>{adminName}</strong>. The user account will remain active
              as a regular user.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-email" className="font-body text-sm">
              Type <strong>{adminEmail}</strong> to confirm
            </Label>
            <Input
              id="confirm-email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={adminEmail}
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
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isMatch || loading}
          >
            {loading ? "Removing..." : "Remove Admin Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
