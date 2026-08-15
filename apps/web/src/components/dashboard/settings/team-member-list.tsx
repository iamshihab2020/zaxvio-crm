"use client";

import { useState } from "react";
import { IconUsersGroup, IconDotsVertical } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { SettingsSection } from "./settings-section";
import { TeamRoleBadge } from "./team-role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";

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

interface TeamMemberListProps {
  members: MemberData[];
  currentUserId: string;
  currentUserRole: string;
  organizationId: string;
  onRefresh: () => void;
}

export function TeamMemberList({
  members,
  currentUserId,
  currentUserRole,
  organizationId,
  onRefresh,
}: TeamMemberListProps) {
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removeMember, setRemoveMember] = useState<MemberData | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  async function handleRoleChange(memberId: string, newRole: string) {
    setLoading(true);
    try {
      const result = await authClient.organization.updateMemberRole({
        memberId,
        role: newRole,
        organizationId,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Failed to update role");
      } else {
        toast.success("Role updated");
        onRefresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setChangingRole(null);
    }
  }

  async function handleRemove() {
    if (!removeMember) return;
    setLoading(true);
    try {
      const result = await authClient.organization.removeMember({
        memberIdOrEmail: removeMember.id,
        organizationId,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Failed to remove member");
      } else {
        toast.success("Member removed");
        setRemoveDialogOpen(false);
        setRemoveMember(null);
        onRefresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
      <SettingsSection
        icon={IconUsersGroup}
        title="Team Members"
        description={`${members.length} ${members.length === 1 ? "member" : "members"}`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Member</TableHead>
              <TableHead className="font-body">Role</TableHead>
              <TableHead className="font-body hidden sm:table-cell">Joined</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isCurrentUser = m.userId === currentUserId;
              const isOwner = m.role === "owner";
              const canEditThis = canManage && !isOwner && !isCurrentUser;

              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-brand-light text-brand text-xs font-heading">
                          {getInitials(m.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground font-body truncate">
                            {m.user.name}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              you
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-body truncate">
                          {m.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {changingRole === m.id ? (
                      <Select
                        defaultValue={m.role}
                        onValueChange={(val) => handleRoleChange(m.id, val)}
                        disabled={loading}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <TeamRoleBadge role={m.role} />
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground font-body">
                      {new Date(m.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {canEditThis && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <IconDotsVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setChangingRole(m.id)}
                              className="cursor-pointer"
                            >
                              Change role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setRemoveMember(m);
                                setRemoveDialogOpen(true);
                              }}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              Remove member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SettingsSection>

      <DeleteConfirmDialog
        entityName="Team Member"
        itemLabel={removeMember?.user.name ?? ""}
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        onConfirm={handleRemove}
        loading={loading}
      />
    </>
  );
}
