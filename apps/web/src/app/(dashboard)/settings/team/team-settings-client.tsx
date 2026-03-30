"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TeamMemberList } from "@/components/dashboard/settings/team-member-list";
import { TeamPendingInvitations } from "@/components/dashboard/settings/team-pending-invitations";
import { TeamInviteDialog } from "@/components/dashboard/settings/team-invite-dialog";

interface MemberData {
  id: string;
  userId: string;
  role: string;
  createdAt: string | Date;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface InvitationData {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
}

export function TeamSettingsClient() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const fetchTeamData = useCallback(async () => {
    try {
      const result = await authClient.organization.getFullOrganization();
      if (result.data) {
        setOrganizationId(result.data.id);
        setMembers((result.data.members ?? []) as MemberData[]);
        setInvitations((result.data.invitations ?? []) as InvitationData[]);
      }

      // Get current user's role
      const activeMember = await authClient.organization.getActiveMember();
      if (activeMember.data) {
        setCurrentUserRole(activeMember.data.role ?? "member");
      }
    } catch {
      // silently fail — will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const currentUserId = session?.user?.id ?? "";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
        {/* Member list */}
        <TeamMemberList
          members={members}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          organizationId={organizationId}
          onRefresh={fetchTeamData}
        />

        {/* Pending invitations */}
        {canManage && (
          <TeamPendingInvitations
            invitations={invitations}
            organizationId={organizationId}
            onRefresh={fetchTeamData}
          />
        )}

        {/* Invite button */}
        {canManage && (
          <Button
            onClick={() => setInviteDialogOpen(true)}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}

        {/* Invite dialog */}
        <TeamInviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          organizationId={organizationId}
          onSuccess={fetchTeamData}
        />
      </div>
    </TooltipProvider>
  );
}
