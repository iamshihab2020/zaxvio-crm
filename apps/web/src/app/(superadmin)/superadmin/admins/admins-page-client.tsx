"use client";

import { useState, useCallback } from "react";
import {
  IconCrown,
  IconShieldLock,
  IconHeadset,
  IconCoin,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddAdminDialog } from "@/components/superadmin/admins/add-admin-dialog";
import { EditAdminTierDialog } from "@/components/superadmin/admins/edit-admin-tier-dialog";
import { RemoveAdminDialog } from "@/components/superadmin/admins/remove-admin-dialog";
import { getAdminUsers } from "@/actions/admin";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  adminTier: string | null;
  isOwner: boolean;
  createdAt: string;
}

const TIER_CONFIG: Record<string, { label: string; icon: typeof IconShieldLock; className: string }> = {
  super_admin: {
    label: "Super Admin",
    icon: IconShieldLock,
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  },
  support: {
    label: "Support",
    icon: IconHeadset,
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  billing_admin: {
    label: "Billing",
    icon: IconCoin,
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminsPageClient({
  initialData,
  currentUserId,
}: {
  initialData: AdminUser[];
  currentUserId: string;
}) {
  const [admins, setAdmins] = useState<AdminUser[]>(initialData);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);

  // Current user is owner if they appear in the admin list with isOwner = true
  const currentUserIsOwner = admins.some(
    (a) => a.id === currentUserId && a.isOwner,
  );

  const refresh = useCallback(async () => {
    const result = await getAdminUsers();
    if (result.data) setAdmins(result.data);
  }, []);

  const canManage = (target: AdminUser): boolean => {
    // Can't manage yourself
    if (target.id === currentUserId) return false;
    // Can't manage owner
    if (target.isOwner) return false;
    // Only owner can manage super_admins
    if (target.adminTier === "super_admin" && !currentUserIsOwner) return false;
    return true;
  };

  return (
    <section className="p-6">
      {/* Card wrapper */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Admin Users
            </h2>
            <p className="text-sm text-muted-foreground font-body">
              {admins.length} admin{admins.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => setAddOpen(true)}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Add Admin
          </Button>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Name</TableHead>
              <TableHead className="font-body">Email</TableHead>
              <TableHead className="font-body">Tier</TableHead>
              <TableHead className="font-body">Role</TableHead>
              <TableHead className="font-body">Added</TableHead>
              <TableHead className="w-12 font-body" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground font-body"
                >
                  No admin users found
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => {
                const tierConfig = admin.adminTier
                  ? TIER_CONFIG[admin.adminTier]
                  : null;
                const TierIcon = tierConfig?.icon;
                const isSelf = admin.id === currentUserId;

                return (
                  <TableRow key={admin.id}>
                    <TableCell className="font-body font-medium">
                      <div className="flex items-center gap-2">
                        {admin.name}
                        {isSelf && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-body text-muted-foreground">
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      {tierConfig && (
                        <Badge
                          variant="outline"
                          className={`inline-flex items-center gap-1.5 ${tierConfig.className}`}
                        >
                          {TierIcon && <TierIcon className="h-3 w-3" />}
                          {tierConfig.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.isOwner && (
                        <Badge className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          <IconCrown className="h-3 w-3" />
                          Owner
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-body text-muted-foreground">
                      {formatDate(admin.createdAt)}
                    </TableCell>
                    <TableCell>
                      {canManage(admin) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconDotsVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditTarget(admin)}
                            >
                              <IconEdit className="mr-2 h-4 w-4" />
                              Edit Tier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setRemoveTarget(admin)}
                            >
                              <IconTrash className="mr-2 h-4 w-4" />
                              Remove Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <AddAdminDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={refresh}
        isOwner={currentUserIsOwner}
      />

      {editTarget && (
        <EditAdminTierDialog
          adminId={editTarget.id}
          adminName={editTarget.name}
          currentTier={editTarget.adminTier ?? "support"}
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSuccess={refresh}
          isOwner={currentUserIsOwner}
        />
      )}

      {removeTarget && (
        <RemoveAdminDialog
          adminId={removeTarget.id}
          adminName={removeTarget.name}
          adminEmail={removeTarget.email}
          open={!!removeTarget}
          onOpenChange={(open) => !open && setRemoveTarget(null)}
          onSuccess={refresh}
        />
      )}
    </section>
  );
}
