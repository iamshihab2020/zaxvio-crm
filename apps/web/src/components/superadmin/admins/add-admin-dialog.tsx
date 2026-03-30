"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAdminUser } from "@/actions/admin";

const TIER_OPTIONS = [
  { value: "super_admin", label: "Super Admin", description: "Full platform control" },
  { value: "support", label: "Support", description: "Tenant support & audit access" },
  { value: "billing_admin", label: "Billing Admin", description: "Subscription management" },
] as const;

export function AddAdminDialog({
  open,
  onOpenChange,
  onSuccess,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isOwner: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminTier, setAdminTier] = useState("");
  const [makeOwner, setMakeOwner] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = name.trim() && email.includes("@") && password.length >= 8 && adminTier;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const result = await createAdminUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      adminTier: makeOwner ? "super_admin" : adminTier,
      makeOwner: makeOwner || undefined,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setName("");
      setEmail("");
      setPassword("");
      setAdminTier("");
      setMakeOwner(false);
      onOpenChange(false);
      onSuccess();
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setError(null);
      setName("");
      setEmail("");
      setPassword("");
      setAdminTier("");
      setMakeOwner(false);
    }
    onOpenChange(value);
  };

  // Filter tier options based on whether caller is owner
  const availableTiers = isOwner
    ? TIER_OPTIONS
    : TIER_OPTIONS.filter((t) => t.value !== "super_admin");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Add Admin User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-name" className="font-body text-sm">
              Full Name
            </Label>
            <Input
              id="admin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="font-body"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="font-body text-sm">
              Email Address
            </Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="font-body"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="font-body text-sm">
              Password
            </Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="pr-10 font-body"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {password && password.length < 8 && (
              <p className="text-xs text-muted-foreground font-body">
                Password must be at least 8 characters
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-tier" className="font-body text-sm">
              Admin Tier
            </Label>
            <Select value={adminTier} onValueChange={setAdminTier}>
              <SelectTrigger className="font-body">
                <SelectValue placeholder="Select a tier" />
              </SelectTrigger>
              <SelectContent>
                {availableTiers.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value} className="font-body">
                    {tier.label} — {tier.description}
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
                  Grant Owner Status
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  Owners have full control and cannot be removed by other admins.
                  Use this for co-founders or business partners. Tier will be set to Super Admin automatically.
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
            disabled={!isValid || loading}
          >
            {loading ? "Creating..." : "Create Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
