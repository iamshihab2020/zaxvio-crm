"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBriefcase } from "@tabler/icons-react";

interface AssetServiceHistoryTabProps {
  equipmentId: string;
}

interface HistoryJob {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  serviceType: string;
  scheduledDate: string;
  completedAt: string | null;
  totalAmount: string;
  customerFirstName: string | null;
  customerLastName: string | null;
}

interface HistoryData {
  jobs: HistoryJob[];
  agreements: Array<{
    id: string;
    contractName: string;
    startDate: string;
    endDate: string;
    isActive: boolean | null;
    annualPrice: string | null;
  }>;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(val: string | null) {
  if (!val) return "—";
  const num = parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const statusColors: Record<string, string> = {
  scheduled:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed:
    "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  cancelled:
    "bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300",
};

export function AssetServiceHistoryTab({
  equipmentId,
}: AssetServiceHistoryTabProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(
        `${API_URL}/equipment/${equipmentId}/history`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data as HistoryData);
      }
    } catch {
      // silent fail
    }
    setLoading(false);
  }, [equipmentId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
        <IconBriefcase className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          No service history
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Jobs linked to this asset will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link
                    href={`/jobs?jobId=${job.id}`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {job.jobNumber || "—"}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {job.title}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">
                  {job.serviceType.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(job.scheduledDate)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={statusColors[job.status] ?? ""}
                  >
                    {job.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {formatCurrency(job.totalAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
