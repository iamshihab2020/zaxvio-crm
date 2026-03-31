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
import { IconBriefcase, IconFileCheck, IconFileDescription } from "@tabler/icons-react";

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

interface HistoryAgreement {
  id: string;
  contractName: string;
  startDate: string;
  endDate: string;
  isActive: boolean | null;
  annualPrice: string | null;
}

interface HistoryQuote {
  id: string;
  quoteNumber: string;
  status: string;
  issuedDate: string;
  totalAmount: string;
  customerFirstName: string | null;
  customerLastName: string | null;
}

interface HistoryData {
  jobs: HistoryJob[];
  agreements: HistoryAgreement[];
  quotes: HistoryQuote[];
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

const jobStatusColors: Record<string, string> = {
  scheduled:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed:
    "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  cancelled:
    "bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300",
};

const quoteStatusColors: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  accepted: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  declined: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  expired: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
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

  const hasJobs = data && data.jobs.length > 0;
  const hasAgreements = data && data.agreements.length > 0;
  const hasQuotes = data && data.quotes?.length > 0;
  const isEmpty = !hasJobs && !hasAgreements && !hasQuotes;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
        <IconBriefcase className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          No service history
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Jobs, quotes, and agreements linked to this asset will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Jobs Section */}
      {hasJobs && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBriefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Jobs ({data.jobs.length})
            </h3>
          </div>
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
                        href={`/jobs/${job.id}`}
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
                        className={jobStatusColors[job.status] ?? ""}
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
      )}

      {/* Quotes Section */}
      {hasQuotes && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconFileDescription className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Quotes ({data.quotes.length})
            </h3>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        {quote.quoteNumber || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(quote.issuedDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={quoteStatusColors[quote.status] ?? ""}
                      >
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatCurrency(quote.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Service Agreements Section */}
      {hasAgreements && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconFileCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Service Agreements ({data.agreements.length})
            </h3>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agreement</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Annual Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agreements.map((agreement) => (
                  <TableRow key={agreement.id}>
                    <TableCell className="text-sm font-medium">
                      {agreement.contractName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(agreement.startDate)} — {formatDate(agreement.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          agreement.isActive
                            ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                            : "bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300"
                        }
                      >
                        {agreement.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatCurrency(agreement.annualPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
