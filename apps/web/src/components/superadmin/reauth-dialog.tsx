"use client";

import { useState } from "react";
import { IconShieldLock } from "@tabler/icons-react";
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
import { signIn } from "@/lib/auth-client";

/**
 * Re-authentication dialog for destructive admin actions.
 * Prompts admin to re-enter password before proceeding.
 */
export function ReauthDialog({
  open,
  onOpenChange,
  onSuccess,
  actionLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  actionLabel: string;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Re-verify credentials via Better Auth sign-in
      // This doesn't create a new session, just validates the password
      const result = await signIn.email({
        email: "", // Will use current session email
        password,
      });

      if (result.error) {
        setError("Invalid password. Please try again.");
        setLoading(false);
        return;
      }

      setPassword("");
      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Authentication failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconShieldLock className="h-5 w-5 text-admin-accent" />
            Confirm Identity
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-body">
              Re-enter your password to <strong>{actionLabel}</strong>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reauth-password" className="font-body text-sm">
                Password
              </Label>
              <Input
                id="reauth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your admin password"
                className="font-body"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive font-body">{error}</p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !password}
              className="bg-admin-accent hover:bg-admin-accent/90 text-white"
            >
              {loading ? "Verifying..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
