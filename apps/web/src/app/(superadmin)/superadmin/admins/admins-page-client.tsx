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

// Secondary columns step in with the width, as `automations-table.tsx` does.
// Written out whole so Tailwind can see them.
const COLUMN_FROM_MD = "hidden md:table-cell";
const COLUMN_FROM_XL = "hidden xl:table-cell";

function TierBadge({ tier }: { tier: string }) {
  const config = TIER_CONFIG[tier];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function OwnerBadge() {
  return (
    <Badge className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
      <IconCrown className="h-3 w-3" />
      Owner
    </Badge>
  );
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
    <section className="p-4 sm:p-6">
      {/* Card wrapper */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Admin Users
            </h2>
            <p className="text-sm text-muted-foreground font-body">
              {admins.length} admin{admins.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90 max-sm:h-10"
            onClick={() => setAddOpen(true)}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Add Admin
          </Button>
        </div>

        {/* Table. Below `md` it is Name and the row menu: email, tier and the
            Owner mark fold under the name, because who an admin is and what
            they can do is the point of this list. The added date is the first
            thing to go and comes back at `xl`: the full row is about 810px,
            more than the content area at `md` or `lg`. */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Name</TableHead>
              <TableHead className={`font-body ${COLUMN_FROM_MD}`}>Email</TableHead>
              <TableHead className={`font-body ${COLUMN_FROM_MD}`}>Tier</TableHead>
              <TableHead className={`font-body ${COLUMN_FROM_MD}`}>Role</TableHead>
              <TableHead className={`font-body ${COLUMN_FROM_XL}`}>Added</TableHead>
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
                      <div className="md:hidden">
                        <p className="mt-0.5 break-all text-xs font-normal text-muted-foreground">
                          {admin.email}
                        </p>
                        {(admin.adminTier || admin.isOwner) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {admin.adminTier && <TierBadge tier={admin.adminTier} />}
                            {admin.isOwner && <OwnerBadge />}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`font-body text-muted-foreground ${COLUMN_FROM_MD}`}>
                      {admin.email}
                    </TableCell>
                    <TableCell className={COLUMN_FROM_MD}>
                      {admin.adminTier && <TierBadge tier={admin.adminTier} />}
                    </TableCell>
                    <TableCell className={COLUMN_FROM_MD}>
                      {admin.isOwner && <OwnerBadge />}
                    </TableCell>
                    <TableCell className={`font-body text-muted-foreground ${COLUMN_FROM_XL}`}>
                      {formatDate(admin.createdAt)}
                    </TableCell>
                    <TableCell>
                      {canManage(admin) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 max-sm:h-10 max-sm:w-10"
                              aria-label={`Actions for ${admin.name}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconDotsVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="max-sm:min-h-10"
                              onClick={() => setEditTarget(admin)}
                            >
                              <IconEdit className="mr-2 h-4 w-4" />
                              Edit Tier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive max-sm:min-h-10"
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
