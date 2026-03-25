"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  IconUser,
  IconFileInvoice,
  IconNote,
} from "@tabler/icons-react";
import { getInvoices, createInvoiceFromJob } from "@/actions/invoices";
import type { JobDetail } from "./job-detail-sheet";

interface JobSidebarPanelProps {
  job: JobDetail;
}

interface LinkedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
}

export function JobSidebarPanel({ job }: JobSidebarPanelProps) {
  const router = useRouter();
  const [linkedInvoice, setLinkedInvoice] = useState<LinkedInvoice | null>(
    null,
  );
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const customerName =
    `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim() ||
    "No customer";
  const initials =
    `${job.customerFirstName?.[0] ?? ""}${job.customerLastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  useEffect(() => {
    setInvoiceLoading(true);
    getInvoices({ jobId: job.id, limit: 1 }).then((res) => {
      if (res.data && res.data.length > 0) {
        setLinkedInvoice(res.data[0] as LinkedInvoice);
      }
      setInvoiceLoading(false);
    });
  }, [job.id]);

  async function handleGenerateInvoice() {
    setGenerating(true);
    const result = await createInvoiceFromJob(job.id);
    setGenerating(false);
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      toast.success(`Invoice ${result.data.invoiceNumber ?? ""} created`);
      router.push(`/invoices/${result.data.id}`);
    }
  }

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Customer Card */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconUser className="h-3.5 w-3.5" />
          Customer
        </h3>
        <div className="rounded-md bg-muted/50 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-brand/10 text-brand text-xs font-heading">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Link
              href={`/customers/${job.customerId}`}
              className="text-sm font-medium text-foreground hover:text-brand transition-colors font-body"
            >
              {customerName}
            </Link>
          </div>
        </div>
      </div>

      {/* Invoice */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconFileInvoice className="h-3.5 w-3.5" />
          Invoice
        </h3>
        {invoiceLoading ? (
          <div className="rounded-md bg-muted/50 p-3 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        ) : linkedInvoice ? (
          <Link
            href={`/invoices/${linkedInvoice.id}`}
            className="flex items-center gap-2 rounded-md bg-muted/50 p-3 hover:bg-muted transition-colors group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light shrink-0">
              <IconFileInvoice className="h-4 w-4 text-brand" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-brand transition-colors font-body">
              {linkedInvoice.invoiceNumber}
            </span>
          </Link>
        ) : (
          <div className="space-y-2">
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground font-body">
                No invoice yet
              </p>
            </div>
            {job.lineItems.length > 0 && (
              <Button
                size="sm"
                onClick={handleGenerateInvoice}
                disabled={generating}
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
              >
                <IconFileInvoice className="mr-1.5 h-3.5 w-3.5" />
                {generating ? "Generating..." : "Generate Invoice"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconNote className="h-3.5 w-3.5" />
          Notes
        </h3>
        <div className="rounded-md bg-muted/50 p-3">
          {job.notes ? (
            <p className="text-sm text-foreground font-body whitespace-pre-wrap">
              {job.notes}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic font-body">
              No notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
