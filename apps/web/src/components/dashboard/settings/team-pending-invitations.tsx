"use client";

import { useState } from "react";
import { IconMailForward, IconX } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { SettingsSection } from "./settings-section";
import { TeamRoleBadge } from "./team-role-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InvitationData {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
  createdAt?: string | Date;
}

interface TeamPendingInvitationsProps {
  invitations: InvitationData[];
  // No `organizationId`. Cancelling an invitation is keyed on the invitation's
  // own id and the server resolves the organisation from the session, so a
  // caller-supplied one could only ever disagree with it.
  onRefresh: () => void;
}

export function TeamPendingInvitations({
  invitations,
  onRefresh,
}: TeamPendingInvitationsProps) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  if (pendingInvitations.length === 0) return null;

  async function handleCancel(invitationId: string) {
    setCancelling(invitationId);
    try {
      const result = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Failed to cancel invitation");
      } else {
        toast.success("Invitation cancelled");
        onRefresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <SettingsSection
      icon={IconMailForward}
      title="Pending Invitations"
      description={`${pendingInvitations.length} pending`}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-body">Email</TableHead>
            <TableHead className="font-body">Role</TableHead>
            <TableHead className="font-body hidden sm:table-cell">Expires</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingInvitations.map((inv) => {
            const expiresAt = new Date(inv.expiresAt);
            const isExpired = expiresAt < new Date();

            return (
              <TableRow key={inv.id}>
                <TableCell>
                  <span className="text-sm font-medium text-foreground font-body">
                    {inv.email}
                  </span>
                </TableCell>
                <TableCell>
                  <TeamRoleBadge role={inv.role} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className={`text-sm font-body ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                    {isExpired
                      ? "Expired"
                      : expiresAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                  </span>
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleCancel(inv.id)}
                        disabled={cancelling === inv.id}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cancel invitation</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsSection>
  );
}
