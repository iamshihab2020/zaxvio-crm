"use client";

import { IconServer, IconWebhook, IconClock } from "@tabler/icons-react";
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
    <section className="p-6 space-y-6">
      {/* Health Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Database</CardTitle>
          </CardHeader>
          <CardContent>
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
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">
              {health?.uptime
                ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
                : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Memory (Heap)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">
              {health?.memory?.heapUsedMB ?? "—"} MB
            </p>
            <p className="text-xs text-muted-foreground font-body">
              of {health?.memory?.heapTotalMB ?? "—"} MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-body text-sm text-muted-foreground">Node.js</CardTitle>
          </CardHeader>
          <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Timestamp</TableHead>
                  <TableHead className="font-body">Provider</TableHead>
                  <TableHead className="font-body">Event</TableHead>
                  <TableHead className="font-body">Status</TableHead>
                  <TableHead className="font-body">Code</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground font-body whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-body text-sm font-medium">
                        {log.provider}
                      </TableCell>
                      <TableCell className="font-body text-sm">
                        {log.eventType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`border-0 text-xs font-body ${STATUS_COLORS[log.status] ?? STATUS_COLORS.received}`}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Started</TableHead>
                  <TableHead className="font-body">Job Name</TableHead>
                  <TableHead className="font-body">Status</TableHead>
                  <TableHead className="font-body">Duration</TableHead>
                  <TableHead className="font-body">Error</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground font-body whitespace-nowrap">
                          {formatDate(job.startedAt)}
                        </TableCell>
                        <TableCell className="font-body text-sm font-medium">
                          {job.jobName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`border-0 text-xs font-body ${STATUS_COLORS[job.status] ?? STATUS_COLORS.running}`}
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-body text-sm text-muted-foreground">
                          {duration !== null ? `${duration}s` : "running..."}
                        </TableCell>
                        <TableCell className="font-body text-xs text-destructive max-w-[200px] truncate">
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
