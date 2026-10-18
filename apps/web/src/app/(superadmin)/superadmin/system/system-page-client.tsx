"use client";

import { IconWebhook, IconClock } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AnimatedNumber } from "@/components/reusable/animated-number";

interface WebhookLog {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  responseCode: number | null;
  error: string | null;
  createdAt: string;
}

interface CronJob {
  id: string;
  jobName: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  error: string | null;
}

interface HealthData {
  uptime: number;
  database: string;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  nodeVersion: string;
}

function formatCount(n: number): string {
  return String(n);
}

function formatUptime(seconds: number): string {
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  processed: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  running: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  error: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function SystemPageClient({
  health,
  webhooks,
  crons,
}: {
  health: HealthData | null;
  webhooks: WebhookLog[];
  crons: CronJob[];
}) {
  return (
    <section data-stagger className="p-4 sm:p-6 space-y-6">
      {/* Health Cards. Two by two on a phone, with 16px card padding and a
          smaller figure so "128.4 MB" fits the ~130px inside a half-width card. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Database</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Badge
              className={`border-0 ${
                health?.database === "healthy"
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              {health?.database ?? "Unknown"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Uptime</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="font-heading text-xl font-bold sm:text-2xl">
              {health?.uptime ? (
                <AnimatedNumber value={health.uptime} format={formatUptime} />
              ) : (
                "—"
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Memory (Heap)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="font-heading text-xl font-bold sm:text-2xl">
              {health?.memory ? (
                <AnimatedNumber value={health.memory.heapUsedMB} format={formatCount} />
              ) : (
                "—"
              )}{" "}
              MB
            </p>
            <p className="text-xs text-muted-foreground font-body">
              of{" "}
              {health?.memory ? (
                <AnimatedNumber value={health.memory.heapTotalMB} format={formatCount} />
              ) : (
                "—"
              )}{" "}
              MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Node.js</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="font-heading text-lg font-bold">{health?.nodeVersion ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Webhook & Cron Logs */}
      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks" className="font-body gap-1.5">
            <IconWebhook className="h-4 w-4" />
            Webhooks
            <Badge variant="secondary" className="ml-1 text-xs">
              {webhooks.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="crons" className="font-body gap-1.5">
            <IconClock className="h-4 w-4" />
            Cron Jobs
            <Badge variant="secondary" className="ml-1 text-xs">
              {crons.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Webhook Logs */}
        <TabsContent value="webhooks" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Below `md`: Timestamp, Event (provider folded under it) and
                Status (response code folded under it). */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Timestamp</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Provider</TableHead>
                  <TableHead className="font-body">Event</TableHead>
                  <TableHead className="font-body">Status</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <IconWebhook className="h-8 w-8" />
                        <p className="text-sm font-body">No webhook logs yet.</p>
                        <p className="text-xs font-body">
                          Webhook events will appear here once Lemon Squeezy or other integrations are configured.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map((log) => (
                    <TableRow key={log.id}>
                      {/* Allowed to wrap on a phone, where the date, the event
                          and the status share the row. */}
                      <TableCell className="text-sm text-muted-foreground font-body md:whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-body text-sm font-medium">
                        {log.provider}
                      </TableCell>
                      {/* Event types are one long snake_case word; `anywhere`
                          lets it break instead of widening the table. */}
                      <TableCell className="font-body text-sm [overflow-wrap:anywhere]">
                        {log.eventType}
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground md:hidden">
                          {log.provider}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`border-0 text-xs font-body ${STATUS_COLORS[log.status] ?? STATUS_COLORS.received}`}
                        >
                          {log.status}
                        </Badge>
                        <p className="mt-1 font-mono text-xs text-muted-foreground md:hidden">
                          {log.responseCode ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {log.responseCode ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Cron Job History */}
        <TabsContent value="crons" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Below `md`: Started, Job Name (duration and any error folded
                under it) and Status. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Started</TableHead>
                  <TableHead className="font-body">Job Name</TableHead>
                  <TableHead className="font-body">Status</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Duration</TableHead>
                  <TableHead className="font-body hidden md:table-cell">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <IconClock className="h-8 w-8" />
                        <p className="text-sm font-body">No cron job history yet.</p>
                        <p className="text-xs font-body">
                          Cron execution logs will appear here once background jobs are configured.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  crons.map((job) => {
                    const duration =
                      job.completedAt && job.startedAt
                        ? Math.round(
                            (new Date(job.completedAt).getTime() -
                              new Date(job.startedAt).getTime()) /
                              1000,
                          )
                        : null;
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="text-sm text-muted-foreground font-body md:whitespace-nowrap">
                          {formatDate(job.startedAt)}
                        </TableCell>
                        <TableCell className="font-body text-sm font-medium [overflow-wrap:anywhere]">
                          {job.jobName}
                          <div className="mt-0.5 text-xs font-normal md:hidden">
                            <p className="text-muted-foreground">
                              {duration !== null ? `${duration}s` : "running..."}
                            </p>
                            {job.error && (
                              <p className="line-clamp-2 text-destructive">{job.error}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`border-0 text-xs font-body ${STATUS_COLORS[job.status] ?? STATUS_COLORS.running}`}
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-body text-sm text-muted-foreground">
                          {duration !== null ? `${duration}s` : "running..."}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-body text-xs text-destructive max-w-[200px] truncate">
                          {job.error ?? "—"}
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
