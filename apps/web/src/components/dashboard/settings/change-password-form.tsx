"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconLock, IconEye, IconEyeOff } from "@tabler/icons-react";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function getPasswordStrength(password: string): {
  score: number;
  label: string;
} {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  // Map 0-5 to 1-4
  const level = Math.min(4, Math.max(1, Math.ceil((score / 5) * 4)));
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return { score: level, label: labels[level] };
}

const strengthColors = [
  "",
  "bg-red-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-green-500",
];

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

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

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
    <SettingsSection
      icon={IconLock}
      title="Security"
      description="Update your password to keep your account secure."
    >
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? (
                <IconEyeOff className="h-4 w-4" />
              ) : (
                <IconEye className="h-4 w-4" />
              )}
            </Button>
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? (
                <IconEyeOff className="h-4 w-4" />
              ) : (
                <IconEye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {/* Password strength indicator */}
          {newPassword && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      level <= strength.score
                        ? strengthColors[strength.score]
                        : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{strength.label}</p>
            </div>
          )}
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

        <SettingsFormMessage message={message} />

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
    </SettingsSection>
  );
}
