"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  IconUser,
  IconUserCheck,
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
import {
  EditableText,
  EditableTextarea,
  EditableSelect,
  EditableDate,
  EditableTime,
} from "@/components/reusable/editable-field";
import { createInvoiceFromJob } from "@/actions/invoices";
import { getJobAssignees, updateJob } from "@/actions/jobs";
import { AssigneePicker, type AssigneeMember } from "./assignee-picker";
import type { JobDetail } from "./job-detail-sheet";

interface JobDetailInfoProps {
  job: JobDetail;
  onFieldSave?: (field: string, value: string) => Promise<void>;
  onJobUpdate?: () => void;
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-body mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

const SERVICE_TYPE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label: label as string,
}));

export function JobDetailInfo({ job, onFieldSave, onJobUpdate }: JobDetailInfoProps) {
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [members, setMembers] = useState<AssigneeMember[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(job.assigneeId);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getJobAssignees().then((res) => {
      if (res.data) setMembers(res.data);
    });
  }, []);

  // Keep local assigneeId in sync when job prop changes
  useEffect(() => {
    setAssigneeId(job.assigneeId);
  }, [job.assigneeId]);

  async function handleAssigneeChange(id: string | null) {
    setAssigneeId(id);
    setAssigneeLoading(true);
    const result = await updateJob(job.id, { assigneeId: id });
    setAssigneeLoading(false);
    if (result.error) {
      toast.error(result.error);
      setAssigneeId(job.assigneeId); // revert
    } else {
      const name = members.find((m) => m.id === id)?.name ?? null;
      toast.success(id ? `Assigned to ${name}` : "Assignee removed");
      onJobUpdate?.();
    }
  }

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

  const subtotal = parseFloat(job.subtotal);
  const taxAmount = parseFloat(job.taxAmount ?? "0");
  const total = parseFloat(job.totalAmount);

  const editable = !!onFieldSave;

  async function saveField(field: string, value: string) {
    if (onFieldSave) await onFieldSave(field, value);
  }

  return (
    <div className="space-y-1 divide-y divide-border/50">
      {/* Customer — read-only */}
      <InfoRow icon={IconUser} label="Customer">
        <p className="text-sm text-foreground font-body">{customerName}</p>
      </InfoRow>

      {/* Assignee */}
      <InfoRow icon={IconUserCheck} label="Assignee">
        {editable ? (
          <AssigneePicker
            value={assigneeId}
            onChange={handleAssigneeChange}
            members={members}
            disabled={assigneeLoading}
            className="w-full justify-start"
          />
        ) : (
          <p className="text-sm text-foreground font-body">
            {job.assigneeName ?? "—"}
          </p>
        )}
      </InfoRow>

      {/* Address */}
      <InfoRow icon={IconMapPin} label="Address">
        {editable ? (
          <EditableText
            value={job.address ?? ""}
            onSave={(v) => saveField("address", v)}
            placeholder="Add address"
          />
        ) : (
          <p className="text-sm text-foreground font-body">{job.address || "—"}</p>
        )}
      </InfoRow>

      {/* Scheduled Date */}
      <InfoRow icon={IconCalendar} label="Scheduled Date">
        {editable ? (
          <EditableDate
            value={job.scheduledDate}
            onSave={(v) => saveField("scheduledDate", v)}
          />
        ) : (
          <p className="text-sm text-foreground font-body">
            {new Date(job.scheduledDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            })}
          </p>
        )}
      </InfoRow>

      {/* Time */}
      <InfoRow icon={IconClock} label="Time">
        {editable ? (
          <div className="flex items-center gap-2">
            <EditableTime
              value={job.scheduledStart}
              onSave={(v) => saveField("scheduledStart", v)}
              placeholder="Start"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <EditableTime
              value={job.scheduledEnd}
              onSave={(v) => saveField("scheduledEnd", v)}
              placeholder="End"
            />
          </div>
        ) : (
          <p className="text-sm text-foreground font-body">
            {job.scheduledStart && job.scheduledEnd
              ? `${formatTime(job.scheduledStart)} - ${formatTime(job.scheduledEnd)}`
              : job.scheduledStart
                ? formatTime(job.scheduledStart)
                : "—"}
          </p>
        )}
      </InfoRow>

      {/* Service Type */}
      <InfoRow icon={IconTool} label="Service Type">
        {editable ? (
          <EditableSelect
            value={job.serviceType}
            options={SERVICE_TYPE_OPTIONS}
            onSave={(v) => saveField("serviceType", v)}
          />
        ) : (
          <p className="text-sm text-foreground font-body">
            {SERVICE_TYPE_LABELS[job.serviceType as ServiceType] ?? job.serviceType}
          </p>
        )}
      </InfoRow>

      {/* Description */}
      <InfoRow icon={IconFileDescription} label="Description">
        {editable ? (
          <EditableTextarea
            value={job.description ?? ""}
            onSave={(v) => saveField("description", v)}
            placeholder="Add description"
          />
        ) : (
          <p className="text-sm text-foreground font-body">{job.description || "—"}</p>
        )}
      </InfoRow>

      {/* Notes */}
      <InfoRow icon={IconNote} label="Notes">
        {editable ? (
          <EditableTextarea
            value={job.notes ?? ""}
            onSave={(v) => saveField("notes", v)}
            placeholder="Add notes"
          />
        ) : (
          <p className="text-sm text-foreground font-body">{job.notes || "—"}</p>
        )}
      </InfoRow>

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

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const amPm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${amPm}`;
}
