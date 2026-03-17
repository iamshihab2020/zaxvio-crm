"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }
    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setMessage(null);

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (result.error) {
        setMessage({
          type: "error",
          text: result.error.message ?? "Failed to change password",
        });
      } else {
        setMessage({
          type: "success",
          text: "Password updated successfully.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    }

    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Change Password</CardTitle>
        <CardDescription className="font-body">
          Update your password to keep your account secure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="font-body">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errors.currentPassword)
                    setErrors((prev) => ({ ...prev, currentPassword: "" }));
                }}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="font-body">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword)
                    setErrors((prev) => ({ ...prev, newPassword: "" }));
                }}
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="font-body">
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword)
                  setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              placeholder="Re-enter new password"
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Message */}
          {message && (
            <div
              className={`rounded-md border px-4 py-3 text-sm font-body ${
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={saving}
            >
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
