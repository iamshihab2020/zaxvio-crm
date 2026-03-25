"use client";

import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/dashboard/settings/profile-form";
import { ChangePasswordForm } from "@/components/dashboard/settings/change-password-form";
import { ProfileSidebar } from "@/components/dashboard/settings/profile-sidebar";

export function ProfileSettingsPageClient() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information skeleton */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          {/* Security skeleton */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-6">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <ProfileForm user={session.user} />
        <ChangePasswordForm />
      </div>
      <div>
        <ProfileSidebar user={session.user} />
      </div>
    </div>
  );
}
