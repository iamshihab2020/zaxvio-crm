"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  IconUser,
  IconMapPin,
  IconCalendar,
  IconClock,
  IconTool,
  IconCurrencyDollar,
  IconFileDescription,
  IconNote,
  IconFileInvoice,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/lib/constants/job-options";
import { createInvoiceFromJob } from "@/actions/invoices";
import type { JobDetail } from "./job-detail-sheet";

interface JobDetailInfoProps {
  job: JobDetail;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <p className="text-sm text-foreground font-body">{value}</p>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const amPm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${amPm}`;
}

export function JobDetailInfo({ job }: JobDetailInfoProps) {
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const router = useRouter();

  async function handleGenerateInvoice() {
    setGeneratingInvoice(true);
    const result = await createInvoiceFromJob(job.id);
    setGeneratingInvoice(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Invoice ${result.data?.invoiceNumber ?? ""} created`);
      router.push("/invoices");
    }
  }

  const customerName =
    job.customerFirstName || job.customerLastName
      ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
      : "No customer";

  const timeRange =
    job.scheduledStart && job.scheduledEnd
      ? `${formatTime(job.scheduledStart)} - ${formatTime(job.scheduledEnd)}`
      : job.scheduledStart
        ? formatTime(job.scheduledStart)
        : null;

  const subtotal = parseFloat(job.subtotal);
  const taxAmount = parseFloat(job.taxAmount ?? "0");
  const total = parseFloat(job.totalAmount);

  return (
    <div className="space-y-1 divide-y divide-border/50">
      <InfoRow icon={IconUser} label="Customer" value={customerName} />
      <InfoRow icon={IconMapPin} label="Address" value={job.address} />
      <InfoRow
        icon={IconCalendar}
        label="Scheduled Date"
        value={formatDate(job.scheduledDate)}
      />
      <InfoRow icon={IconClock} label="Time" value={timeRange} />
      <InfoRow
        icon={IconTool}
        label="Service Type"
        value={SERVICE_TYPE_LABELS[job.serviceType as ServiceType] ?? job.serviceType}
      />
      <InfoRow
        icon={IconFileDescription}
        label="Description"
        value={job.description}
      />
      <InfoRow icon={IconNote} label="Notes" value={job.notes} />

      {/* Financial summary */}
      <div className="pt-3">
        <div className="flex items-center gap-2 mb-2">
          <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-body">Financials</p>
        </div>
        <div className="bg-muted/30 rounded-md p-3 space-y-1">
          <div className="flex justify-between text-sm font-body">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${subtotal.toFixed(2)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-sm font-body">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-foreground">${taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold font-body border-t border-border/50 pt-1">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Generate Invoice button — visible when job has line items */}
        {job.lineItems.length > 0 && (
          <Button
            size="sm"
            onClick={handleGenerateInvoice}
            disabled={generatingInvoice}
            className="mt-3 w-full bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
          >
            <IconFileInvoice className="mr-1.5 h-3.5 w-3.5" />
            {generatingInvoice ? "Generating..." : "Generate Invoice"}
          </Button>
        )}
      </div>
    </div>
  );
}
