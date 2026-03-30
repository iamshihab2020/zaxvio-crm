"use client";

import { IconShieldCheck, IconEye } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <section className="p-6 space-y-6">
      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit" className="font-body gap-1.5">
            <IconShieldCheck className="h-4 w-4" />
            Audit Log
            <Badge variant="secondary" className="ml-1 text-xs">
              {auditPagination.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="impersonation" className="font-body gap-1.5">
            <IconEye className="h-4 w-4" />
            Impersonation Log
            <Badge variant="secondary" className="ml-1 text-xs">
              {impersonationPagination.total}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Timestamp</TableHead>
                  <TableHead className="font-body">Admin</TableHead>
                  <TableHead className="font-body">Action</TableHead>
                  <TableHead className="font-body">Target Tenant</TableHead>
                  <TableHead className="font-body">IP</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground font-body whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-sm font-body">
                        {entry.targetTenantName ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Started</TableHead>
                  <TableHead className="font-body">Admin</TableHead>
                  <TableHead className="font-body">Tenant</TableHead>
                  <TableHead className="font-body">Reason</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground font-body whitespace-nowrap">
                          {formatDate(entry.startedAt)}
                        </TableCell>
                        <TableCell className="text-sm font-body">
                          {entry.adminName ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm font-body font-medium">
                          {entry.tenantName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-body max-w-[200px] truncate">
                          {entry.reason}
                        </TableCell>
                        <TableCell className="text-sm font-body">
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
