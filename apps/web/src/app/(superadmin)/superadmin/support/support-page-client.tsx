"use client";

import { IconShieldCheck, IconEye } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditEntry {
  id: string;
  adminUserId: string;
  adminName: string | null;
  adminEmail: string | null;
  action: string;
  targetTenantId: string | null;
  targetTenantName: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ImpersonationEntry {
  id: string;
  adminUserId: string;
  adminName: string | null;
  tenantId: string;
  tenantName: string | null;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  actionsTaken: unknown[] | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  tenant_deactivate: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  tenant_activate: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  tenant_delete: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  trial_extend: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  subscription_override: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  tenant_edit: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
  impersonate_start: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  impersonate_end: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function SupportPageClient({
  auditLog,
  auditPagination,
  impersonationLog,
  impersonationPagination,
}: {
  auditLog: AuditEntry[];
  auditPagination: Pagination;
  impersonationLog: ImpersonationEntry[];
  impersonationPagination: Pagination;
}) {
  return (
    <section className="p-4 sm:p-6 space-y-6">
      <Tabs defaultValue="audit">
        {/* The icons go below `sm`: with both labels and their counts the
            tabs are about 335px, which is the whole 343px phone content. */}
        <TabsList>
          <TabsTrigger value="audit" className="font-body gap-1.5">
            <IconShieldCheck className="h-4 w-4 max-sm:hidden" />
            Audit Log
            <Badge variant="secondary" className="ml-1 text-xs">
              {auditPagination.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="impersonation" className="font-body gap-1.5">
            <IconEye className="h-4 w-4 max-sm:hidden" />
            Impersonation Log
            <Badge variant="secondary" className="ml-1 text-xs">
              {impersonationPagination.total}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Below `md` the log is two columns: when, and what, with the
                admin, the target tenant and the IP folded under the action.
                Nothing is dropped; five columns of a log do not fit 343px. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Timestamp</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Admin</TableHead>
                  <TableHead className="font-body">Action</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Target Tenant</TableHead>
                  <TableHead className="font-body hidden md:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <p className="text-sm text-muted-foreground font-body">
                        No audit entries yet.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLog.map((entry) => (
                    <TableRow key={entry.id}>
                      {/* Allowed to wrap on a phone, where the date and the
                          action have to share the row. */}
                      <TableCell className="text-sm text-muted-foreground font-body md:whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div>
                          <p className="text-sm font-medium font-body">
                            {entry.adminName ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground font-body">
                            {entry.adminEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`border-0 text-xs font-body ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                        >
                          {formatAction(entry.action)}
                        </Badge>
                        <div className="mt-1 space-y-0.5 md:hidden">
                          <p className="text-xs text-muted-foreground font-body">
                            {entry.adminName ?? "Unknown"}
                            {entry.targetTenantName && ` · ${entry.targetTenantName}`}
                          </p>
                          {entry.ipAddress && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {entry.ipAddress}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-body">
                        {entry.targetTenantName ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                        {entry.ipAddress ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Impersonation Log Tab */}
        <TabsContent value="impersonation" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Below `md`: Started, Tenant (with the admin and the reason folded
                under it) and Duration. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Started</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Admin</TableHead>
                  <TableHead className="font-body">Tenant</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Reason</TableHead>
                  <TableHead className="font-body">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impersonationLog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <p className="text-sm text-muted-foreground font-body">
                        No impersonation sessions yet.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  impersonationLog.map((entry) => {
                    const duration =
                      entry.endedAt && entry.startedAt
                        ? Math.round(
                            (new Date(entry.endedAt).getTime() -
                              new Date(entry.startedAt).getTime()) /
                              60000,
                          )
                        : null;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm text-muted-foreground font-body md:whitespace-nowrap">
                          {formatDate(entry.startedAt)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-body">
                          {entry.adminName ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm font-body font-medium">
                          {entry.tenantName ?? "—"}
                          <div className="mt-0.5 text-xs font-normal text-muted-foreground md:hidden">
                            <p>{entry.adminName ?? "Unknown"}</p>
                            <p className="line-clamp-2">{entry.reason}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-body max-w-[200px] truncate">
                          {entry.reason}
                        </TableCell>
                        <TableCell className="text-sm font-body whitespace-nowrap">
                          {entry.endedAt ? (
                            `${duration}m`
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-0 text-xs">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
