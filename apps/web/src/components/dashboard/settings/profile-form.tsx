"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconUser } from "@tabler/icons-react";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import { authClient } from "@/lib/auth-client";

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    emailVerified: boolean;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const hasChanges = name !== user.name || email !== user.email;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;

    setSaving(true);
    setMessage(null);

    try {
      // Update name if changed
      if (name !== user.name) {
        const result = await authClient.updateUser({ name });
        if (result.error) {
          setMessage({ type: "error", text: result.error.message ?? "Failed to update name" });
          setSaving(false);
          return;
        }
      }

      // Change email if changed
      if (email !== user.email) {
        const result = await authClient.changeEmail({ newEmail: email });
        if (result.error) {
          setMessage({
            type: "error",
            text: result.error.message ?? "Failed to update email",
          });
          setSaving(false);
          return;
        }
        setMessage({
          type: "success",
          text: "Profile updated. A verification email has been sent to your new email address.",
        });
      } else {
        setMessage({ type: "success", text: "Profile updated successfully." });
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    }

    setSaving(false);
  }

  // Generate initials for avatar
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SettingsSection
      icon={IconUser}
      title="Profile Information"
      description="Update your personal information."
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-brand/20 bg-brand/10 text-brand font-heading text-2xl font-bold">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground font-body">
              {user.name}
            </p>
            <p className="text-sm text-muted-foreground font-body">
              {user.email}
            </p>
          </div>
        </div>

        {/* Name + Email in 2-col grid on desktop */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="font-body">
              Name
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="profile-email" className="font-body">
                Email
              </Label>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  user.emailVerified ? "bg-green-500" : "bg-amber-500"
                }`}
              />
              <Badge
                variant="secondary"
                className={
                  user.emailVerified
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                }
              >
                {user.emailVerified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
        </div>

        <SettingsFormMessage message={message} />

        {/* Save */}
        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={!hasChanges || saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
