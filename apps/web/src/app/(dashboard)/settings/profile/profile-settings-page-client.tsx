"use client";

import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/dashboard/settings/profile-form";
import { ChangePasswordForm } from "@/components/dashboard/settings/change-password-form";

export function ProfileSettingsPageClient() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <p className="text-sm text-muted-foreground font-body">
        Unable to load profile. Please try refreshing the page.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ProfileForm user={session.user} />
      <ChangePasswordForm />
    </div>
  );
}
